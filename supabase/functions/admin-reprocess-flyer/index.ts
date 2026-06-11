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

  // Filter out batches whose source file was purged after extraction.
  // We no longer keep raw.json or audit attachment copies (M-3 / C-1), so
  // there's nothing to rebuild from. Admins can re-forward the email if needed.
  workingBatches = workingBatches.filter(
    (b: any) => b.stored_file_url && b.stored_file_url !== "purged",
  );

  if (workingBatches.length === 0) {
    return json({
      error: "Original flyer files have been purged after extraction. Re-forward the email to reprocess.",
    }, 410);
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

  return json({ ok: true, batches: workingBatches.length, triggered });
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
