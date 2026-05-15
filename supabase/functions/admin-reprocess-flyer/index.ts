// Admin-only: re-trigger extract-flyer-deals for every batch attached to a
// given promo_email_ingestion. Used by the "Reprocess" button on the admin
// email inbox when a store was just reassigned or extraction needs a retry.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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
  const ingestionId = String(input.ingestion_id ?? "").trim();
  if (!ingestionId) return json({ error: "ingestion_id required" }, 400);

  const { data: ingestion, error: iErr } = await admin
    .from("promo_email_ingestions")
    .select("id, matched_store_id")
    .eq("id", ingestionId)
    .maybeSingle();
  if (iErr || !ingestion) return json({ error: "ingestion not found" }, 404);
  if (!ingestion.matched_store_id) return json({ error: "assign a store first" }, 400);

  const { data: batches, error: bErr } = await admin
    .from("flyer_extraction_batches")
    .select("id, stored_file_url, store_id")
    .eq("source_email_id", ingestionId);
  if (bErr) return json({ error: bErr.message }, 500);

  let workingBatches = batches ?? [];

  // Fallback: if no batches exist (e.g. email was needs_assignment originally),
  // create them from the raw attachments in the promo-emails bucket.
  if (workingBatches.length === 0) {
    const { data: files, error: lErr } = await admin.storage
      .from("promo-emails")
      .list(`${ingestionId}/attachments`, { limit: 50 });
    if (lErr) return json({ error: `list attachments failed: ${lErr.message}` }, 500);
    if (!files || files.length === 0) {
      return json({ error: "no attachments stored for this email" }, 400);
    }

    for (const f of files) {
      const srcPath = `${ingestionId}/attachments/${f.name}`;
      const flyerPath = `email/${ingestionId}/${f.name}`;
      const ct = (f.metadata as any)?.mimetype ?? "application/octet-stream";
      if (!/^(application\/pdf|image\/)/.test(ct)) continue;

      // Copy from promo-emails -> flyer-uploads (where extract-flyer-deals reads)
      const { data: dl, error: dlErr } = await admin.storage.from("promo-emails").download(srcPath);
      if (dlErr || !dl) { console.error("download failed", dlErr); continue; }
      const { error: upErr } = await admin.storage
        .from("flyer-uploads")
        .upload(flyerPath, dl, { upsert: true, contentType: ct });
      if (upErr) { console.error("upload failed", upErr); continue; }

      const { data: batch, error: insErr } = await admin
        .from("flyer_extraction_batches")
        .insert({
          store_id: ingestion.matched_store_id,
          admin_user_id: null,
          original_filename: f.name.slice(0, 200),
          stored_file_url: flyerPath,
          file_type: ct,
          page_count: 1,
          extraction_status: "pending",
          source_email_id: ingestionId,
        })
        .select("id, stored_file_url, store_id")
        .maybeSingle();
      if (insErr || !batch) { console.error("batch insert failed", insErr); continue; }
      workingBatches.push(batch);
    }

    if (workingBatches.length === 0) {
      return json({ error: "no usable attachments (PDF/image) found in storage" }, 400);
    }
  }


  let triggered = 0;
  for (const b of workingBatches) {
    // Sync the batch to the currently-matched store (in case it was reassigned)
    // and reset status so extract-flyer-deals will pick it up cleanly.
    await admin
      .from("flyer_extraction_batches")
      .update({
        store_id: ingestion.matched_store_id,
        extraction_status: "pending",
        extracted_items_count: 0,
      })
      .eq("id", b.id);

    const res = await fetch(`${url}/functions/v1/extract-flyer-deals`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ batch_id: b.id }),
    }).catch((e) => {
      console.error("extract invoke failed", e);
      return null;
    });
    if (res) triggered++;
  }

  await admin
    .from("promo_email_ingestions")
    .update({ status: "processed" })
    .eq("id", ingestionId);

  return json({ ok: true, batches: batches.length, triggered });
});

async function safeJson(req: Request): Promise<any> {
  try { return await req.json(); } catch { return {}; }
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
