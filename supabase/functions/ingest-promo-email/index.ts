// Public webhook (no JWT): Resend Inbound posts each received email here.
// We verify the Svix-style signature, save the raw email + attachments,
// resolve which store the email is about, and kick off extract-flyer-deals
// for each flyer attachment.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ATTACHMENT_MIME = /^(application\/pdf|image\/(png|jpe?g|webp))$/i;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const rawBody = await req.text();

  // Verify Svix signature (Resend uses Svix for webhook signing).
  if (webhookSecret) {
    const svixId = req.headers.get("svix-id");
    const svixTs = req.headers.get("svix-timestamp");
    const svixSig = req.headers.get("svix-signature");
    if (!svixId || !svixTs || !svixSig) {
      return json({ error: "missing signature headers" }, 401);
    }
    const ok = await verifySvix(webhookSecret, svixId, svixTs, rawBody, svixSig);
    if (!ok) return json({ error: "invalid signature" }, 401);
  } else {
    console.warn("ingest-promo-email: RESEND_WEBHOOK_SECRET not set — accepting unsigned requests (dev only)");
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "invalid json" }, 400); }

  // Resend wraps inbound emails under `data` with `type: "email.received"`.
  const data = payload?.data ?? payload;
  const fromAddress: string = String(data.from ?? data.from_email ?? "").trim().toLowerCase();
  const toRaw = data.to ?? data.to_email ?? "";
  const toAddress: string = Array.isArray(toRaw) ? String(toRaw[0] ?? "") : String(toRaw);
  const subject: string = String(data.subject ?? "");
  const text: string = String(data.text ?? data.body_plain ?? "");
  const html: string = String(data.html ?? data.body_html ?? "");
  const attachments: any[] = Array.isArray(data.attachments) ? data.attachments : [];
  const fromDomain = fromAddress.includes("@") ? fromAddress.split("@").pop()! : "";

  // Insert ingestion row first so we have an id for storage paths.
  const { data: row, error: insErr } = await admin.from("promo_email_ingestions").insert({
    from_address: fromAddress || "unknown",
    from_domain: fromDomain || "unknown",
    to_address: toAddress || null,
    subject: subject.slice(0, 500),
    body_text_excerpt: (text || stripHtml(html)).slice(0, 2000),
    attachment_count: attachments.length,
    status: "received",
  }).select("id").maybeSingle();

  if (insErr || !row) {
    console.error("insert ingestion failed", insErr);
    return json({ error: "could not record email" }, 500);
  }
  const ingestionId = row.id as string;

  try {
    // Save raw email body for audit
    await admin.storage
      .from("promo-emails")
      .upload(`${ingestionId}/raw.json`, new Blob([rawBody], { type: "application/json" }), { upsert: true });

    // --- Match a store ---
    const match = await matchStore(admin, { fromAddress, fromDomain, text, html, subject });

    await admin.from("promo_email_ingestions").update({
      raw_storage_path: `${ingestionId}/raw.json`,
      matched_store_id: match.storeId,
      match_confidence: match.confidence,
      match_method: match.method,
      detected_zip: match.zip,
      detected_address: match.address,
      notes: match.notes,
    }).eq("id", ingestionId);

    if (!match.storeId) {
      await admin.from("promo_email_ingestions").update({
        status: "needs_assignment",
      }).eq("id", ingestionId);
      return json({ ok: true, ingestion_id: ingestionId, status: "needs_assignment" });
    }

    // --- Iterate attachments ---
    let batchesCreated = 0;
    for (let i = 0; i < attachments.length; i++) {
      const a = attachments[i];
      const filename: string = String(a.filename ?? a.name ?? `attachment-${i}`);
      const contentType: string = String(a.contentType ?? a.content_type ?? "");
      if (!ALLOWED_ATTACHMENT_MIME.test(contentType)) continue;

      const bytes = decodeAttachmentContent(a);
      if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_ATTACHMENT_BYTES) continue;

      // Upload attachment to promo-emails (audit) and to flyer-uploads (where extract-flyer-deals reads from)
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const promoPath = `${ingestionId}/attachments/${i}-${safeName}`;
      const flyerPath = `email/${ingestionId}/${i}-${safeName}`;

      await admin.storage.from("promo-emails").upload(promoPath, new Blob([bytes], { type: contentType }), { upsert: true });
      const { error: upErr } = await admin.storage.from("flyer-uploads").upload(flyerPath, new Blob([bytes], { type: contentType }), { upsert: true });
      if (upErr) { console.error("flyer upload failed", upErr); continue; }

      const { data: batch, error: bErr } = await admin.from("flyer_extraction_batches").insert({
        store_id: match.storeId,
        admin_user_id: null,
        original_filename: filename.slice(0, 200),
        stored_file_url: flyerPath,
        file_type: contentType,
        page_count: 1,
        extraction_status: "pending",
        source_email_id: ingestionId,
      }).select("id").maybeSingle();

      if (bErr || !batch) { console.error("batch insert failed", bErr); continue; }
      batchesCreated++;

      // Fire-and-forget: invoke extract-flyer-deals with service-role auth
      fetch(`${url}/functions/v1/extract-flyer-deals`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batch_id: batch.id }),
      }).catch((e) => console.error("extract invoke failed", e));
    }

    await admin.from("promo_email_ingestions").update({
      status: batchesCreated > 0 ? "processed" : "no_attachments",
    }).eq("id", ingestionId);

    return json({ ok: true, ingestion_id: ingestionId, batches_created: batchesCreated, matched_store_id: match.storeId });
  } catch (e) {
    console.error("ingest-promo-email fatal:", e);
    await admin.from("promo_email_ingestions").update({
      status: "failed",
      notes: e instanceof Error ? e.message : String(e),
    }).eq("id", ingestionId);
    return json({ error: "ingestion failed" }, 500);
  }
});

// -------- helpers --------

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ")
             .replace(/<script[\s\S]*?<\/script>/gi, " ")
             .replace(/<[^>]+>/g, " ")
             .replace(/\s+/g, " ").trim();
}

function decodeAttachmentContent(a: any): Uint8Array | null {
  // Resend supplies base64 in `content` (string). Sometimes it's `data` or already bytes.
  const raw = a.content ?? a.data ?? a.body;
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const bin = atob(raw.replace(/\s+/g, ""));
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch { return null; }
  }
  if (raw instanceof Uint8Array) return raw;
  return null;
}

type MatchResult = {
  storeId: string | null;
  confidence: "high" | "low" | "unmatched";
  method: string;
  zip: string | null;
  address: string | null;
  notes: string | null;
};

async function matchStore(admin: any, p: { fromAddress: string; fromDomain: string; text: string; html: string; subject: string }): Promise<MatchResult> {
  const body = `${p.subject}\n${p.text}\n${stripHtml(p.html)}`;
  const zipMatch = body.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[1] : null;

  // Address pattern: "<number> <street words>, <city>, <STATE> <zip>"
  const addrMatch = body.match(/\d{1,6}\s+[A-Z][A-Za-z0-9 .'-]{2,60},\s*[A-Z][A-Za-z .'-]{2,40},\s*[A-Z]{2}\s+\d{5}/);
  const address = addrMatch ? addrMatch[0] : null;

  // 1) Exact alias: from_address
  let alias: any = null;
  const { data: aliasByAddr } = await admin
    .from("store_email_aliases").select("*")
    .eq("match_type", "from_address").eq("match_value", p.fromAddress).maybeSingle();
  alias = aliasByAddr;
  if (!alias) {
    const { data: aliasByDomain } = await admin
      .from("store_email_aliases").select("*")
      .eq("match_type", "from_domain").eq("match_value", p.fromDomain).maybeSingle();
    alias = aliasByDomain;
  }

  if (alias?.store_id) {
    return { storeId: alias.store_id, confidence: "high", method: "alias_store", zip, address, notes: null };
  }

  // Alias points at chain — narrow by ZIP
  if (alias?.chain_name && zip) {
    const { data: store } = await admin
      .from("specialty_stores").select("id")
      .eq("chain_name", alias.chain_name).eq("zip_code", zip).eq("active", true)
      .maybeSingle();
    if (store) return { storeId: store.id, confidence: "high", method: "alias_chain_zip", zip, address, notes: null };
    // Fallback: any store of that chain
    const { data: anyStore } = await admin
      .from("specialty_stores").select("id")
      .eq("chain_name", alias.chain_name).eq("active", true).limit(1).maybeSingle();
    if (anyStore) return { storeId: anyStore.id, confidence: "low", method: "alias_chain_only", zip, address, notes: "chain matched but ZIP didn't pin a location" };
  }

  // 2) ZIP-only fallback
  if (zip) {
    const { data: stores } = await admin
      .from("specialty_stores").select("id, chain_name")
      .eq("zip_code", zip).eq("active", true).limit(2);
    if (stores && stores.length === 1) {
      return { storeId: stores[0].id, confidence: "low", method: "zip_only", zip, address, notes: null };
    }
  }

  return { storeId: null, confidence: "unmatched", method: "none", zip, address, notes: alias ? "alias found but couldn't resolve store" : null };
}

// Svix-style signature verification (HMAC-SHA256 of `${id}.${ts}.${body}` keyed by secret bytes).
async function verifySvix(secret: string, id: string, ts: string, body: string, sigHeader: string): Promise<boolean> {
  // Resend signing secrets are formatted "whsec_<base64>" — strip the prefix and base64-decode.
  const secretRaw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    const bin = atob(secretRaw);
    keyBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) keyBytes[i] = bin.charCodeAt(i);
  } catch {
    keyBytes = new TextEncoder().encode(secretRaw);
  }

  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const data = new TextEncoder().encode(`${id}.${ts}.${body}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  // Header is space-separated list of "v1,<base64sig>" entries
  return sigHeader.split(" ").some((part) => {
    const [, value] = part.split(",");
    return value && timingSafeEqual(value, expected);
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
