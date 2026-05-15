// Dev-only helper: synthesizes a signed Resend Inbound webhook payload
// (with a tiny embedded PDF) and posts it to ingest-promo-email so we can
// verify the whole inbound pipeline without setting up real DNS / Resend Inbound.
//
// Usage: POST /functions/v1/dev-test-promo-ingest
//   body (optional): { store_id?: string, from?: string }
//
// It will (idempotently) create a `store_email_aliases` row mapping the
// `from` address to the chosen store, then sign + post a synthetic email.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Smallest valid PDF (single empty page) — base64 encoded.
const TINY_PDF_B64 =
  "JVBERi0xLjEKJcKlwrHDqwoKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCgoyIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2VzCiAgICAgL0tpZHMgWzMgMCBSXQogICAgIC9Db3VudCAxCiAgICAgL01lZGlhQm94IFswIDAgMzAwIDE0NF0KICA+PgplbmRvYmoKCjMgMCBvYmoKICA8PCAgL1R5cGUgL1BhZ2UKICAgICAgL1BhcmVudCAyIDAgUgogICAgICAvUmVzb3VyY2VzCiAgICAgICA8PCAvRm9udAogICAgICAgICAgIDw8IC9GMQogICAgICAgICAgICAgICA8PCAvVHlwZSAvRm9udAogICAgICAgICAgICAgICAgICAvU3VidHlwZSAvVHlwZTEKICAgICAgICAgICAgICAgICAgL0Jhc2VGb250IC9UaW1lcy1Sb21hbgogICAgICAgICAgICAgICA+PgogICAgICAgICAgID4+CiAgICAgICA+PgogICAgICAvQ29udGVudHMgNCAwIFIKICA+PgplbmRvYmoKCjQgMCBvYmoKICA8PCAvTGVuZ3RoIDU1ID4+CnN0cmVhbQogIEJUCiAgICAvRjEgMTggVGYKICAgIDAgMCBUZAogICAgKEhlbGxvIFdvcmxkKSBUagogIEVUCmVuZHN0cmVhbQplbmRvYmoKCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxOCAwMDAwMCBuIAowMDAwMDAwMDc3IDAwMDAwIG4gCjAwMDAwMDAxNzggMDAwMDAgbiAKMDAwMDAwMDQ1NyAwMDAwMCBuIAp0cmFpbGVyCiAgPDwgIC9Sb290IDEgMCBSCiAgICAgIC9TaXplIDUKICA+PgpzdGFydHhyZWYKNTY1CiUlRU9G";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) return json({ error: "RESEND_WEBHOOK_SECRET not set" }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const input = await safeJson(req);
  const fromAddress = String(input.from ?? "weeklyad@test-grocer.example").toLowerCase();
  let storeId = input.store_id as string | undefined;
  if (!storeId) {
    const { data } = await admin.from("specialty_stores").select("id").eq("active", true).limit(1).maybeSingle();
    storeId = data?.id;
  }
  if (!storeId) return json({ error: "no active store available" }, 400);

  // Idempotently upsert an alias so matchStore() returns this store.
  await admin.from("store_email_aliases").upsert({
    match_type: "from_address",
    match_value: fromAddress,
    store_id: storeId,
  }, { onConflict: "match_type,match_value" });

  const payload = {
    type: "email.received",
    data: {
      from: fromAddress,
      to: ["deals@saverspantry.com"],
      subject: "[TEST] Weekly flyer — synthetic ingest",
      text: "Hello! This is a synthetic test email with a tiny PDF flyer attached. Test address: 100 Main St, Springfield, IL 60606.",
      html: "<p>This is a synthetic test email with a tiny PDF flyer attached.</p>",
      attachments: [
        {
          filename: "test-flyer.pdf",
          contentType: "application/pdf",
          content: TINY_PDF_B64,
        },
      ],
    },
  };

  const body = JSON.stringify(payload);
  const id = `msg_test_${crypto.randomUUID()}`;
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = await svixSign(secret, id, ts, body);

  const res = await fetch(`${url}/functions/v1/ingest-promo-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "svix-id": id,
      "svix-timestamp": ts,
      "svix-signature": `v1,${sig}`,
    },
    body,
  });

  const text = await res.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = text; }

  return json({
    posted_to: "ingest-promo-email",
    used_store_id: storeId,
    used_from: fromAddress,
    upstream_status: res.status,
    upstream_response: parsed,
  });
});

async function svixSign(secret: string, id: string, ts: string, body: string): Promise<string> {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    const bin = atob(raw);
    keyBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) keyBytes[i] = bin.charCodeAt(i);
  } catch {
    keyBytes = new TextEncoder().encode(raw);
  }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function safeJson(req: Request): Promise<any> {
  try { return await req.json(); } catch { return {}; }
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
