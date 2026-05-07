import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const since = new Date(Date.now() - 35 * 60 * 1000).toISOString();
    const { data: sales } = await supabase
      .from("sale_observations")
      .select("id, food_name, store_name, sale_price_usd, regular_price_usd, savings_pct, created_at")
      .gte("created_at", since)
      .in("moderation_status", ["auto_approved", "approved"]);

    const { data: watches } = await supabase
      .from("watchlist_items")
      .select("user_id, food_name, min_savings_pct, min_savings_usd, snoozed_until");

    const now = new Date();
    const notifs: any[] = [];
    for (const s of sales ?? []) {
      for (const w of watches ?? []) {
        if (w.snoozed_until && new Date(w.snoozed_until) > now) continue;
        if (!s.food_name?.toLowerCase().includes(w.food_name.toLowerCase()) &&
            !w.food_name.toLowerCase().includes(s.food_name?.toLowerCase() ?? "")) continue;
        const savedUsd = Number(s.regular_price_usd ?? 0) - Number(s.sale_price_usd ?? 0);
        const savedPct = Number(s.savings_pct ?? 0);
        if (savedPct < (w.min_savings_pct ?? 0)) continue;
        if (savedUsd < Number(w.min_savings_usd ?? 0)) continue;
        notifs.push({
          user_id: w.user_id,
          kind: "sale_match",
          title: `${s.food_name} on sale at ${s.store_name}`,
          body: `$${Number(s.sale_price_usd).toFixed(2)} — save ${savedPct ? Math.round(savedPct) + "%" : "$" + savedUsd.toFixed(2)}`,
          link: "/sales",
          metadata: { sale_id: s.id, food: s.food_name },
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
