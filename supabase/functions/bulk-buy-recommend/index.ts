import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Inline regional multipliers (kept in sync with src/lib/regionalCost.ts).
const STATE_MULTIPLIERS: Record<string, { label: string; multiplier: number }> = {
  HI: { label: "Hawaii", multiplier: 1.30 },
  AK: { label: "Alaska", multiplier: 1.27 },
  CA: { label: "California", multiplier: 1.13 },
  NY: { label: "New York", multiplier: 1.13 },
  MA: { label: "Massachusetts", multiplier: 1.10 },
  DC: { label: "Washington, DC", multiplier: 1.10 },
  WA: { label: "Washington", multiplier: 1.08 },
  NJ: { label: "New Jersey", multiplier: 1.08 },
  CT: { label: "Connecticut", multiplier: 1.08 },
  OR: { label: "Oregon", multiplier: 1.06 },
  VT: { label: "Vermont", multiplier: 1.05 },
  MD: { label: "Maryland", multiplier: 1.05 },
  RI: { label: "Rhode Island", multiplier: 1.05 },
  NH: { label: "New Hampshire", multiplier: 1.04 },
  CO: { label: "Colorado", multiplier: 1.04 },
};

const HIGH_COST_ZIP3: Record<string, string> = {};
const ZIP_RANGES: [number, number, string][] = [
  [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [50, 59, "VT"], [60, 69, "CT"],
  [70, 89, "NJ"], [100, 149, "NY"], [200, 205, "DC"], [206, 219, "MD"],
  [800, 816, "CO"], [900, 961, "CA"], [967, 968, "HI"], [970, 979, "OR"],
  [980, 994, "WA"], [995, 999, "AK"],
];
for (const [lo, hi, st] of ZIP_RANGES) {
  for (let i = lo; i <= hi; i++) HIGH_COST_ZIP3[String(i).padStart(3, "0")] = st;
}
function stateFromZip(zip?: string | null): string | null {
  if (!zip) return null;
  const z = String(zip).trim();
  if (!/^\d{5}/.test(z)) return null;
  return HIGH_COST_ZIP3[z.slice(0, 3)] ?? null;
}

// USDA anchor — represents typical "Male 19-50, Moderate-Cost Plan" monthly
// food cost at the time curated bulk-buy unit prices were set. If current USDA
// data differs, scale prices by current/anchor to reflect food inflation.
const USDA_ANCHOR_USD = 360;
const FACTOR_MIN = 0.85;
const FACTOR_MAX = 1.40;

// ---------- Sanity clamps for per-unit prices ----------
// Plausible 2025 US retail per-unit ranges, used as a last-line defense
// against bad seed data or runaway adjustment factors slipping into the UI.
// Ranges are intentionally generous (cover budget→premium specialty) so we
// only clamp obviously broken numbers.
type Range = { min: number; max: number };
const UNIT_RANGES: Record<string, Range> = {
  lb:      { min: 0.30, max: 60 },   // rice, beans, flour … truffle salt
  oz:      { min: 0.10, max: 40 },   // spices, saffron-ish ceiling
  "fl oz": { min: 0.05, max: 6 },    // oils, sauces, vinegars
  L:       { min: 1.50, max: 80 },   // oils, sauces by liter
  ml:      { min: 0.002, max: 0.10 },
  g:       { min: 0.005, max: 1.50 },
  kg:      { min: 1.00, max: 120 },
  ct:      { min: 0.05, max: 8 },    // tortillas, eggs, packs
  sheet:   { min: 0.05, max: 3 },    // nori
  unit:    { min: 0.50, max: 60 },   // fallback
};

function parsePackUnit(label: string | null | undefined): { qty: number | null; unit: string } {
  if (!label) return { qty: null, unit: "unit" };
  const s = label.toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(fl\s?oz|oz|lb|lbs|pound|pounds|kg|g|gram|grams|ml|l|liter|liters|dozen|doz|ct|count|pack|pk|sheet|sheets)\b/);
  if (!m) return { qty: null, unit: "unit" };
  let qty = parseFloat(m[1]);
  let unit = m[2].replace(/\s/g, "");
  const map: Record<string, string> = {
    lbs: "lb", pound: "lb", pounds: "lb",
    gram: "g", grams: "g",
    liter: "L", liters: "L", l: "L",
    floz: "fl oz",
    count: "ct", pack: "ct", pk: "ct",
    sheets: "sheet",
  };
  if (unit === "dozen" || unit === "doz") { qty *= 12; unit = "ct"; }
  unit = map[unit] ?? unit;
  return { qty, unit };
}

function clampPrice(value: number, unit: string): { value: number; clamped: "low" | "high" | null } {
  const r = UNIT_RANGES[unit] ?? UNIT_RANGES.unit;
  if (!isFinite(value) || value <= 0) return { value: r.min, clamped: "low" };
  if (value < r.min) return { value: r.min, clamped: "low" };
  if (value > r.max) return { value: r.max, clamped: "high" };
  return { value, clamped: null };
}

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

    // Profile (now also pulls zip_code for regional adjustment)
    const { data: profile } = await supabase
      .from("profiles")
      .select("cuisine_preferences, cuisine_filter_enabled, household_size, zip_code")
      .eq("user_id", user.id)
      .maybeSingle();

    const cuisinePrefs: string[] = (profile?.cuisine_preferences ?? []) as string[];
    const filterOn = (profile?.cuisine_filter_enabled ?? true) && respectFilter && cuisinePrefs.length > 0;
    const householdSize = Math.max(1, profile?.household_size ?? 2);

    // ---------- Pricing-adjustment factors ----------
    // 1) USDA national factor (with fallback to 1.0 if no data)
    let usdaFactor = 1.0;
    let usdaReportMonth: string | null = null;
    let usdaSource: "usda" | "fallback_curated" = "fallback_curated";
    const { data: usdaRow } = await supabase
      .from("usda_food_plans")
      .select("monthly_cost_usd, report_month")
      .eq("plan", "moderate_cost")
      .eq("household_type", "Male 19-50 years")
      .order("report_month", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (usdaRow?.monthly_cost_usd) {
      const raw = Number(usdaRow.monthly_cost_usd) / USDA_ANCHOR_USD;
      usdaFactor = Math.max(FACTOR_MIN, Math.min(FACTOR_MAX, raw));
      usdaReportMonth = usdaRow.report_month as string;
      usdaSource = "usda";
    }

    // 2) Regional state multiplier
    const stateCode = stateFromZip(profile?.zip_code);
    const regional = stateCode ? STATE_MULTIPLIERS[stateCode] ?? null : null;
    const regionalMultiplier = regional?.multiplier ?? 1.0;

    const appliedFactor = usdaFactor * regionalMultiplier;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // Candidates
    let q = supabase.from("bulk_buy_candidates").select("*");
    if (filterOn) {
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

    // Active sales
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

    // Score & enrich (apply price adjustment here)
    const enriched = (candidates ?? []).map((c: any) => {
      const nameKey = c.food_name.toLowerCase();
      const usedQty = Object.entries(consumptionByName).reduce((sum, [k, v]) => {
        if (k.includes(nameKey) || nameKey.includes(k)) return sum + (v as number);
        return sum;
      }, 0);
      const matchedSale = Object.entries(saleByFood).find(([k]) => k.includes(nameKey) || nameKey.includes(k))?.[1];

      const baseTypical = Number(c.typical_unit_price_usd);
      const baseBulk = Number(c.bulk_unit_price_usd);

      // Infer unit from the pack label so we can sanity-check per-unit prices.
      const { unit: packUnit } = parsePackUnit(c.bulk_pack_size);

      // 1) Clamp the raw seed prices to plausible per-unit ranges. Bad seed
      //    data (e.g. $0.09/lb rice) gets pulled up to the floor before any
      //    adjustment is applied.
      const seedTypical = clampPrice(baseTypical, packUnit);
      const seedBulk = clampPrice(baseBulk, packUnit);

      // 2) Apply the USDA × regional factor, then clamp again so the final
      //    displayed price can never exceed the realistic ceiling either.
      const finalTypical = clampPrice(round2(seedTypical.value * appliedFactor), packUnit);
      const finalBulk = clampPrice(round2(seedBulk.value * appliedFactor), packUnit);

      // Ensure bulk is not more expensive than typical after clamping; if a
      // ceiling collapse made them equal/inverted, nudge bulk down 10%.
      let adjTypical = finalTypical.value;
      let adjBulk = finalBulk.value;
      if (adjBulk >= adjTypical) adjBulk = round2(adjTypical * 0.9);

      const priceClamped =
        !!(seedTypical.clamped || seedBulk.clamped || finalTypical.clamped || finalBulk.clamped);

      const monthlyUnits = usedQty > 0 ? (usedQty / 3) : householdSize * 1;
      const monthlySavings = Math.max(0, monthlyUnits * (adjTypical - adjBulk));

      const reasons: string[] = [];
      if (usedQty > 0) reasons.push(`You used ~${(usedQty).toFixed(1)} in the last 90 days`);
      if (matchedSale) reasons.push(`On sale at ${matchedSale.store_name}`);
      if (c.confidence === "high") reasons.push("High-confidence pricing");

      const score =
        (usedQty > 0 ? 50 : 0) +
        (matchedSale ? 30 : 0) +
        Math.min(20, Number(c.est_savings_pct) / 5) +
        (cuisinePrefs.some((p) => (c.cuisine_tags ?? []).includes(p)) ? 15 : 0);

      if (priceClamped) {
        console.warn("[bulk-buy] price clamped", {
          food: c.food_name,
          unit: packUnit,
          baseTypical, baseBulk,
          adjTypical, adjBulk,
          flags: {
            seedTypical: seedTypical.clamped,
            seedBulk: seedBulk.clamped,
            finalTypical: finalTypical.clamped,
            finalBulk: finalBulk.clamped,
          },
        });
      }

      return {
        ...c,
        typical_unit_price_usd: adjTypical,
        bulk_unit_price_usd: adjBulk,
        base_typical_unit_price_usd: baseTypical,
        base_bulk_unit_price_usd: baseBulk,
        price_clamped: priceClamped,
        price_unit: packUnit,
        used_qty_90d: usedQty,
        on_sale: !!matchedSale,
        sale: matchedSale ?? null,
        est_monthly_savings_usd: round2(monthlySavings),
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
      total_monthly_savings_usd: round2(totalMonthlySavings),
      cuisine_preferences: cuisinePrefs,
      filter_applied: filterOn,
      pricing_adjustment: {
        applied_factor: Math.round(appliedFactor * 1000) / 1000,
        usda_factor: Math.round(usdaFactor * 1000) / 1000,
        usda_source: usdaSource,
        usda_report_month: usdaReportMonth,
        usda_anchor_usd: USDA_ANCHOR_USD,
        regional_multiplier: regionalMultiplier,
        regional_state: stateCode,
        regional_label: regional?.label ?? null,
        fallback_used: usdaSource === "fallback_curated",
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("bulk-buy-recommend error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
