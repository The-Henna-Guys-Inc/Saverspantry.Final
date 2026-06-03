import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkCronAuth } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const isoMonday = (d: Date) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const unauth = await checkCronAuth(req);
  if (unauth) return unauth;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const weekStart = isoMonday(new Date());
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);

    const { data: events } = await supabase
      .from("savings_events")
      .select("user_id, category, amount_usd")
      .gte("occurred_at", weekStart.toISOString())
      .lt("occurred_at", weekEnd.toISOString());

    const byUser: Record<string, { total: number; cats: Record<string, number>; swap: number; sale: number; meal: number }> = {};
    for (const e of events ?? []) {
      const u = byUser[e.user_id] ||= { total: 0, cats: {}, swap: 0, sale: 0, meal: 0 };
      const amt = Number(e.amount_usd) || 0;
      u.total += amt;
      u.cats[e.category] = (u.cats[e.category] || 0) + amt;
      if (e.category === "swap") u.swap++;
      if (e.category === "sale") u.sale++;
      if (e.category === "meal_plan") u.meal++;
    }

    const wsDate = weekStart.toISOString().slice(0, 10);
    const rows = Object.entries(byUser).map(([user_id, v]) => ({
      user_id,
      week_start: wsDate,
      total_savings_usd: Math.round(v.total * 100) / 100,
      by_category: v.cats,
      swap_count: v.swap,
      sale_count: v.sale,
      meal_plan_count: v.meal,
    }));

    if (rows.length) {
      // upsert
      for (const r of rows) {
        await supabase.from("analytics_snapshots").upsert(r as any, { onConflict: "user_id,week_start" });
      }
      // notify users with savings
      const notifs = rows.filter((r) => r.total_savings_usd > 0).map((r) => ({
        user_id: r.user_id,
        kind: "weekly_recap",
        title: `You saved $${r.total_savings_usd.toFixed(2)} this week`,
        body: `Across ${r.swap_count + r.sale_count + r.meal_plan_count} actions. Tap to see your dashboard.`,
        link: "/dashboard",
        metadata: { week_start: r.week_start },
      }));
      if (notifs.length) await supabase.from("notifications").insert(notifs);
    }

    return new Response(JSON.stringify({ users: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
