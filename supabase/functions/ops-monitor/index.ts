// Ops monitor: scans recent activity and records operational alerts.
// Triggered via pg_cron (hourly). No JWT required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Thresholds (override via env if needed)
const DAILY_AI_COST_USD = Number(Deno.env.get("ALERT_DAILY_AI_COST_USD") ?? "5");
const HOURLY_AI_COST_USD = Number(Deno.env.get("ALERT_HOURLY_AI_COST_USD") ?? "1.5");
const ERROR_RATE_THRESHOLD = Number(Deno.env.get("ALERT_ERROR_RATE") ?? "0.25");
const MIN_REQUESTS_FOR_RATE = 20;
const STALE_TICKET_HOURS = 48;

async function record(
  sb: ReturnType<typeof createClient>,
  alert_type: string,
  severity: "info" | "warning" | "critical",
  title: string,
  message: string,
  metadata: Record<string, unknown> = {},
  dedupe_minutes = 360,
) {
  await sb.rpc("record_alert", {
    _alert_type: alert_type,
    _severity: severity,
    _title: title,
    _message: message,
    _metadata: metadata,
    _dedupe_minutes: dedupe_minutes,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const checks: string[] = [];

  try {
    // 1. AI cost (last 24h)
    const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: usage24 } = await sb
      .from("ai_usage_log")
      .select("cost_usd, success, function_name")
      .gte("created_at", since24);

    if (usage24?.length) {
      const total = usage24.reduce((s, r: any) => s + Number(r.cost_usd || 0), 0);
      checks.push(`24h AI cost $${total.toFixed(2)}`);
      if (total >= DAILY_AI_COST_USD) {
        await record(sb, "ai_cost_daily", total >= DAILY_AI_COST_USD * 2 ? "critical" : "warning",
          "Daily AI cost threshold exceeded",
          `AI spend in the last 24h is $${total.toFixed(2)} (threshold $${DAILY_AI_COST_USD}).`,
          { total_usd: total, threshold_usd: DAILY_AI_COST_USD, requests: usage24.length },
          1440);
      }
    }

    // 2. AI cost (last 1h spike)
    const since1h = new Date(Date.now() - 3600_000).toISOString();
    const { data: usage1h } = await sb
      .from("ai_usage_log")
      .select("cost_usd")
      .gte("created_at", since1h);
    if (usage1h?.length) {
      const total = usage1h.reduce((s, r: any) => s + Number(r.cost_usd || 0), 0);
      if (total >= HOURLY_AI_COST_USD) {
        await record(sb, "ai_cost_hourly", "warning",
          "AI cost spike detected",
          `AI spend in the last hour is $${total.toFixed(2)} (threshold $${HOURLY_AI_COST_USD}).`,
          { total_usd: total, threshold_usd: HOURLY_AI_COST_USD },
          120);
      }
    }

    // 3. Error rate per function (last 6h)
    const since6h = new Date(Date.now() - 6 * 3600_000).toISOString();
    const { data: usage6h } = await sb
      .from("ai_usage_log")
      .select("function_name, success")
      .gte("created_at", since6h);
    if (usage6h?.length) {
      const byFn = new Map<string, { total: number; errors: number }>();
      for (const r of usage6h as any[]) {
        const cur = byFn.get(r.function_name) ?? { total: 0, errors: 0 };
        cur.total++;
        if (!r.success) cur.errors++;
        byFn.set(r.function_name, cur);
      }
      for (const [fn, s] of byFn.entries()) {
        if (s.total >= MIN_REQUESTS_FOR_RATE && s.errors / s.total >= ERROR_RATE_THRESHOLD) {
          await record(sb, `error_rate:${fn}`, "critical",
            `High error rate: ${fn}`,
            `${fn} has ${s.errors}/${s.total} failures (${((s.errors / s.total) * 100).toFixed(1)}%) in the last 6h.`,
            { function_name: fn, total: s.total, errors: s.errors },
            360);
        }
      }
    }

    // 4. Stale support tickets
    const staleSince = new Date(Date.now() - STALE_TICKET_HOURS * 3600_000).toISOString();
    const { count: staleCount } = await sb
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "awaiting_user"])
      .lt("last_message_at", staleSince);
    if ((staleCount ?? 0) > 0) {
      await record(sb, "stale_tickets", "warning",
        "Stale support tickets",
        `${staleCount} ticket(s) have had no activity in over ${STALE_TICKET_HOURS}h.`,
        { count: staleCount, threshold_hours: STALE_TICKET_HOURS },
        720);
    }

    return new Response(JSON.stringify({ ok: true, checks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ops-monitor error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
