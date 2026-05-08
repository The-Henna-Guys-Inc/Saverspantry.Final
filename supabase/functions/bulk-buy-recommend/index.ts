import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const respectFilter: boolean = body?.respectFilter !== false;

    // Profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("cuisine_preferences, cuisine_filter_enabled, household_size")
      .eq("user_id", user.id)
      .maybeSingle();

    const cuisinePrefs: string[] = (profile?.cuisine_preferences ?? []) as string[];
    const filterOn = (profile?.cuisine_filter_enabled ?? true) && respectFilter && cuisinePrefs.length > 0;
    const householdSize = Math.max(1, profile?.household_size ?? 2);

    // Candidates
    let q = supabase.from("bulk_buy_candidates").select("*");
    if (filterOn) {
      // Match either a tagged candidate overlapping prefs OR generic (no tags)
      q = q.or(`cuisine_tags.ov.{${cuisinePrefs.join(",")}},cuisine_tags.eq.{}`);
    }
    const { data: candidates, error: cErr } = await q;
    if (cErr) throw cErr;

    // Consumption history (last 90 days)
    const since = new Date(Date.now() - 90 * 86400 * 1000).toISOString();
    const { data: consumption } = await supabase
      .from("pantry_consumption_log")
      .select("item_name, quantity_used")
      .eq("user_id", user.id)
      .gte("used_at", since);

    const consumptionByName: Record<string, number> = {};
    for (const c of consumption ?? []) {
      const k = (c.item_name ?? "").toLowerCase();
      consumptionByName[k] = (consumptionByName[k] ?? 0) + Number(c.quantity_used ?? 0);
    }

    // Active sales for sale-flagging
    const { data: sales } = await supabase
      .from("sale_observations")
      .select("food_name, sale_price_usd, store_name, ends_at, savings_pct")
      .in("moderation_status", ["auto_approved", "approved"])
      .gt("ends_at", new Date().toISOString());

    const saleByFood: Record<string, any> = {};
    for (const s of sales ?? []) {
      const k = (s.food_name ?? "").toLowerCase();
      if (!saleByFood[k]) saleByFood[k] = s;
    }

    // Score & enrich
    const enriched = (candidates ?? []).map((c: any) => {
      const nameKey = c.food_name.toLowerCase();
      const usedQty = Object.entries(consumptionByName).reduce((sum, [k, v]) => {
        if (k.includes(nameKey) || nameKey.includes(k)) return sum + (v as number);
        return sum;
      }, 0);
      const matchedSale = Object.entries(saleByFood).find(([k]) => k.includes(nameKey) || nameKey.includes(k))?.[1];

      // Savings per typical "monthly" use: assume 1 unit per person per month if no consumption data,
      // otherwise project 30-day usage from the 90-day window.
      const monthlyUnits = usedQty > 0 ? (usedQty / 3) : householdSize * 1;
      const monthlySavings = Math.max(0, monthlyUnits * (Number(c.typical_unit_price_usd) - Number(c.bulk_unit_price_usd)));

      const reasons: string[] = [];
      if (usedQty > 0) reasons.push(`You used ~${(usedQty).toFixed(1)} in the last 90 days`);
      if (matchedSale) reasons.push(`On sale at ${matchedSale.store_name}`);
      if (c.confidence === "high") reasons.push("High-confidence pricing");

      const score =
        (usedQty > 0 ? 50 : 0) +
        (matchedSale ? 30 : 0) +
        Math.min(20, Number(c.est_savings_pct) / 5) +
        (cuisinePrefs.some((p) => (c.cuisine_tags ?? []).includes(p)) ? 15 : 0);

      return {
        ...c,
        used_qty_90d: usedQty,
        on_sale: !!matchedSale,
        sale: matchedSale ?? null,
        est_monthly_savings_usd: Math.round(monthlySavings * 100) / 100,
        reasons,
        score,
      };
    });

    enriched.sort((a, b) => b.score - a.score);

    const totalMonthlySavings = enriched
      .slice(0, 10)
      .reduce((s, x) => s + x.est_monthly_savings_usd, 0);

    return new Response(JSON.stringify({
      recommendations: enriched,
      total_monthly_savings_usd: Math.round(totalMonthlySavings * 100) / 100,
      cuisine_preferences: cuisinePrefs,
      filter_applied: filterOn,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("bulk-buy-recommend error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
