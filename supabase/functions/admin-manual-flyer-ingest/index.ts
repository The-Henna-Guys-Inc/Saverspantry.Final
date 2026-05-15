// Admin-only: manually synthesize an inbound promo email and post it through
// the same signed webhook path as Resend Inbound. Lets admins test the flyer
// pipeline by uploading attachments + filling a from/subject/body.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Attachment = { filename: string; contentType: string; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) return json({ error: "RESEND_WEBHOOK_SECRET not set" }, 500);

  // Verify the caller is an admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing auth" }, 401);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "invalid auth" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "admin only" }, 403);

  const input = await safeJson(req);
  const fromAddress = String(input.from ?? "").trim().toLowerCase();
  const subject = String(input.subject ?? "[Manual] Flyer test").slice(0, 500);
  const text = String(input.text ?? "");
  const html = String(input.html ?? "");
  const attachments = Array.isArray(input.attachments) ? (input.attachments as Attachment[]) : [];

  if (!fromAddress || !fromAddress.includes("@")) {
    return json({ error: "from must be a valid email" }, 400);
  }
  if (attachments.length === 0 && !text && !html) {
    return json({ error: "provide attachments or body text/html" }, 400);
  }
  for (const a of attachments) {
    if (!a?.filename || !a?.contentType || !a?.content) {
      return json({ error: "each attachment needs filename, contentType, content (base64)" }, 400);
    }
  }

  // Optionally upsert an alias so matchStore() resolves to a chosen store
  const storeId = typeof input.store_id === "string" ? input.store_id : undefined;
  if (storeId) {
    await admin.from("store_email_aliases").upsert({
      match_type: "from_address",
      match_value: fromAddress,
      store_id: storeId,
    }, { onConflict: "match_type,match_value" });
  }

  const payload = {
    type: "email.received",
    data: {
      from: fromAddress,
      to: [String(input.to ?? "deals@saverspantry.com")],
      subject,
      text,
      html,
      attachments,
    },
  };

  const body = JSON.stringify(payload);
  const id = `msg_manual_${crypto.randomUUID()}`;
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

  const respText = await res.text();
  let parsed: unknown;
  try { parsed = JSON.parse(respText); } catch { parsed = respText; }

  return json({
    ok: res.ok,
    upstream_status: res.status,
    upstream_response: parsed,
    used_from: fromAddress,
    used_store_id: storeId ?? null,
    attachment_count: attachments.length,
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
