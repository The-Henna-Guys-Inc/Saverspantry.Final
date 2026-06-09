// Scheduled / on-demand: iterate active `flyer_sources`, call import-flyer-from-url
// for each, write back last_run status. Protects credits with a per-run cap and
// a "recently scraped" skip window.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const BodySchema = z.object({
  source_ids: z.array(z.string().uuid()).optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  force: z.boolean().optional(),       // ignore the 5-day skip window
  max_per_run: z.number().int().min(1).max(60).optional(),
  triggered_by: z.string().optional(), // "cron" | "admin"
}).default({});

const DEFAULT_MAX = 30;
const SKIP_WINDOW_DAYS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const cronSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Auth: either x-cron-secret OR an admin user JWT.
  let actingAdminId: string | null = null;
  let isCron = false;
  if (cronSecret) {
    const { data: ok } = await admin.rpc("verify_cron_secret", { _secret: cronSecret });
    if (!ok) return json({ error: "bad cron secret" }, 401);
    isCron = true;
    // Use first admin as the synthetic actor for batch ownership.
    const { data: firstAdmin } = await admin.from("user_roles")
      .select("user_id").eq("role", "admin").limit(1).maybeSingle();
    if (!firstAdmin) return json({ error: "no admin user to attribute batches to" }, 500);
    actingAdminId = firstAdmin.user_id;
  } else {
    if (!token) return json({ error: "missing auth" }, 401);
    const userClient = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json({ error: "invalid auth" }, 401);
    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "admin only" }, 403);
    actingAdminId = userRes.user.id;
  }

  const parsed = BodySchema.safeParse(await safeJson(req));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const opts = parsed.data;
  const cap = opts.max_per_run ?? DEFAULT_MAX;

  let q = admin.from("flyer_sources").select("*").eq("active", true);
  if (opts.source_ids?.length) q = q.in("id", opts.source_ids);
  if (opts.region) q = q.eq("region", opts.region);
  if (opts.city) q = q.eq("city", opts.city);
  const { data: sources, error } = await q.order("last_run_at", { ascending: true, nullsFirst: true });
  if (error) return json({ error: error.message }, 500);

  const cutoff = Date.now() - SKIP_WINDOW_DAYS * 86400_000;
  const candidates = (sources ?? []).filter((s: any) => {
    if (opts.source_ids?.length) return true;          // explicit pick: always run
    if (opts.force) return true;
    if (!s.last_run_at) return true;
    return new Date(s.last_run_at).getTime() < cutoff;
  }).slice(0, cap);

  const results: any[] = [];
  for (const src of candidates) {
    const startedAt = new Date().toISOString();
    try {
      // Resolve current week's URL + selector actions (cached when fresh).
      let resolvedUrl = src.flyer_url;
      let actions: any[] | null = null;
      let forceFc = src.render_mode === "firecrawl" || !!src.requires_week_select;
      try {
        const rr = await fetch(`${supaUrl}/functions/v1/resolve-flyer-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ source_id: src.id }),
        });
        const rj = await rr.json().catch(() => ({}));
        if (rr.ok && rj?.resolved_url) {
          resolvedUrl = rj.resolved_url;
          actions = rj.actions ?? null;
          forceFc = !!rj.force_firecrawl;
        }
      } catch (_) { /* fall back to stored URL */ }

      const r = await fetch(`${supaUrl}/functions/v1/import-flyer-from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          url: resolvedUrl,
          store_id: src.default_store_id ?? null,
          internal_admin_user_id: actingAdminId,
          force_firecrawl: forceFc,
          firecrawl_actions: actions,
        }),
      });
      const data = await r.json().catch(() => ({}));
      const ok = r.ok && !data?.error;
      await admin.from("flyer_sources").update({
        last_run_at: startedAt,
        last_status: ok ? "ok" : `error:${r.status}`,
        last_error: ok ? null : String(data?.error ?? "").slice(0, 500),
        last_batch_id: data?.batch_id ?? null,
        consecutive_failures: ok ? 0 : (src.consecutive_failures ?? 0) + 1,
        active: !ok && (src.consecutive_failures ?? 0) + 1 >= 3 ? false : src.active,
      }).eq("id", src.id);

      if (!ok && (src.consecutive_failures ?? 0) + 1 >= 3) {
        await admin.rpc("record_alert", {
          _alert_type: "flyer_source_disabled",
          _severity: "warning",
          _title: `Auto-disabled flyer source: ${src.chain_name}`,
          _message: `3 consecutive failures. Last error: ${String(data?.error ?? r.status).slice(0, 200)}`,
          _metadata: { source_id: src.id, url: src.flyer_url },
        });
      }

      results.push({ id: src.id, chain: src.chain_name, ok, batch_id: data?.batch_id, error: data?.error });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("flyer_sources").update({
        last_run_at: startedAt, last_status: "exception", last_error: msg.slice(0, 500),
        consecutive_failures: (src.consecutive_failures ?? 0) + 1,
      }).eq("id", src.id);
      results.push({ id: src.id, chain: src.chain_name, ok: false, error: msg });
    }
  }

  return json({
    ok: true,
    triggered_by: opts.triggered_by ?? (isCron ? "cron" : "admin"),
    scanned: sources?.length ?? 0,
    ran: results.length,
    skipped: (sources?.length ?? 0) - results.length,
    results,
  });
});

async function safeJson(req: Request) { try { return await req.json(); } catch { return {}; } }
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
