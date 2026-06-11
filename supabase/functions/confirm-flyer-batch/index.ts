// Admin-only: finalize a flyer batch in status 'awaiting_confirmation'.
// Takes the admin's chosen store + validity window and inserts the
// pending_deals JSON onto sale_observations with moderation_status = 'pending_review'.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const BodySchema = z.object({
  batch_id: z.string().uuid(),
  store_id: z.string().uuid(),
  valid_from: z.string().min(8),   // YYYY-MM-DD
  valid_until: z.string().min(8),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
  const { data: roleRow } = await admin.from("user_roles").select("role")
    .eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ error: "admin only" }, 403);

  const parsed = BodySchema.safeParse(await safeJson(req));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const { batch_id, store_id, valid_from, valid_until } = parsed.data;

  const fromDate = new Date(valid_from);
  const untilDate = new Date(valid_until + "T23:59:59Z");
  if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(untilDate.getTime()) || untilDate <= fromDate) {
    return json({ error: "valid_until must be after valid_from" }, 400);
  }

  const { data: batch, error: bErr } = await admin
    .from("flyer_extraction_batches").select("*").eq("id", batch_id).maybeSingle();
  if (bErr || !batch) return json({ error: "batch not found" }, 404);
  if (batch.extraction_status !== "awaiting_confirmation") {
    return json({ error: `batch status is ${batch.extraction_status}, not awaiting_confirmation` }, 409);
  }

  const { data: store } = await admin.from("specialty_stores")
    .select("name, chain_name, city, region").eq("id", store_id).maybeSingle();
  if (!store) return json({ error: "store not found" }, 404);

  const pending: any[] = Array.isArray(batch.pending_deals) ? batch.pending_deals : [];
  const rows = pending.map((d) => ({
    food_name: String(d.food_name ?? "").toLowerCase().slice(0, 80),
    title: String(d.title ?? "").slice(0, 160),
    store_id,
    store_name: store.name,
    store_chain: store.chain_name ?? null,
    city: store.city ?? null,
    region: store.region ?? null,
    sale_price_usd: Number(d.sale_price_usd),
    regular_price_usd: d.regular_price_usd != null ? Number(d.regular_price_usd) : null,
    savings_pct: d.savings_pct ?? null,
    pack_size: d.pack_size ?? null,
    category: d.category ?? null,
    starts_at: fromDate.toISOString(),
    ends_at: untilDate.toISOString(),
    source: "admin_curated",
    moderation_status: "pending_review",
    extraction_batch_id: batch_id,
    approved_by_admin_id: userRes.user.id,
  })).filter((r) => r.food_name && r.title && Number.isFinite(r.sale_price_usd) && r.sale_price_usd > 0);

  let inserted = 0;
  if (rows.length) {
    const { error: insErr, count } = await admin.from("sale_observations").insert(rows, { count: "exact" });
    if (insErr) return json({ error: `insert: ${insErr.message}` }, 500);
    inserted = count ?? rows.length;
  }

  // ToS/copyright hygiene: purge source flyer file once admin has reviewed the
  // extracted facts. We keep only the structured deal rows, not the original
  // copyrighted creative work. See plan: C-1.
  let purgedPath: string | null = null;
  if (batch.stored_file_url && batch.stored_file_url !== "purged") {
    try {
      await admin.storage.from("flyer-uploads").remove([batch.stored_file_url]);
      purgedPath = batch.stored_file_url;
    } catch (e) {
      console.warn("flyer purge failed (non-fatal):", e);
    }
  }

  await admin.from("flyer_extraction_batches").update({
    extraction_status: "completed",
    store_id,
    flyer_valid_from: fromDate.toISOString(),
    flyer_valid_until: untilDate.toISOString(),
    extracted_items_count: rows.length,
    pending_deals: null,
    confirmed_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    stored_file_url: purgedPath ? "purged" : batch.stored_file_url,
  }).eq("id", batch_id);

  return json({ ok: true, batch_id, inserted });
});


async function safeJson(req: Request): Promise<any> { try { return await req.json(); } catch { return {}; } }
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
