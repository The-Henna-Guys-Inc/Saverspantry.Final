import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkCronAuth } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const unauth = await checkCronAuth(req);
  if (unauth) return unauth;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const since = new Date(Date.now() - 35 * 60 * 1000).toISOString();
    const { data: sales } = await supabase
      .from("sale_observations")
      .select("id, food_name, store_name, sale_price_usd, regular_price_usd, savings_pct, address, city, region, created_at")
      .gte("created_at", since)
      .in("moderation_status", ["auto_approved", "approved"]);

    const { data: watches } = await supabase
      .from("watchlist_items")
      .select("user_id, food_name, min_savings_pct, min_savings_usd, snoozed_until");

    // Build user -> zip map for everyone with watches
    const userIds = Array.from(new Set((watches ?? []).map((w) => w.user_id)));
    const zipByUser = new Map<string, string | null>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, zip_code")
        .in("user_id", userIds);
      for (const p of profs ?? []) zipByUser.set(p.user_id, (p.zip_code ?? "").trim() || null);
    }

    const now = new Date();
    const seen = new Set<string>(); // dedupe per user+sale
    const notifs: any[] = [];
    for (const s of sales ?? []) {
      const haystack = `${s.address ?? ""} ${s.city ?? ""} ${s.region ?? ""}`.toLowerCase();
      const savedUsd = Number(s.regular_price_usd ?? 0) - Number(s.sale_price_usd ?? 0);
      const savedPct = Number(s.savings_pct ?? 0);
      // Strict: only notify when sale is at least 15% off
      if (savedPct < 15) continue;

      for (const w of watches ?? []) {
        if (w.snoozed_until && new Date(w.snoozed_until) > now) continue;

        // Zip-code gate: require user has zip and sale's address mentions it
        const zip = zipByUser.get(w.user_id);
        if (!zip) continue;
        if (!haystack.includes(zip.toLowerCase())) continue;

        const sName = (s.food_name ?? "").toLowerCase();
        const wName = w.food_name.toLowerCase();
        if (!sName.includes(wName) && !wName.includes(sName)) continue;

        if (savedPct < (w.min_savings_pct ?? 15)) continue;
        if (savedUsd < Number(w.min_savings_usd ?? 0)) continue;

        const key = `${w.user_id}:${s.id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        notifs.push({
          user_id: w.user_id,
          kind: "sale_match",
          title: `${s.food_name} on sale at ${s.store_name}`,
          body: `$${Number(s.sale_price_usd).toFixed(2)} — save ${Math.round(savedPct)}% near ${zip}`,
          link: "/sales",
          metadata: { sale_id: s.id, food: s.food_name, zip },
        });
      }
    }

    if (notifs.length) await supabase.from("notifications").insert(notifs);
    return new Response(JSON.stringify({ matched: notifs.length, sales: sales?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
