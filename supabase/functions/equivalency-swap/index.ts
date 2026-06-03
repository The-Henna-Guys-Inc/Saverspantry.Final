// Nutrition equivalency engine — swap a food for cheaper, nutritionally-equivalent alternatives
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { cacheGet, cachePut, getUserIdFromAuth, logAiUsage, stableHash } from "../_shared/aiUsage.ts";

const FN = "equivalency-swap";
const MODEL = "google/gemini-2.5-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOL = {
  type: "function",
  function: {
    name: "return_swaps",
    description: "Return 3 nutritionally-equivalent food swaps for the given food.",
    parameters: {
      type: "object",
      properties: {
        original: {
          type: "object",
          properties: {
            name: { type: "string" },
            protein_g: { type: "number" },
            calories_kcal: { type: "number" },
            estimated_cost_usd: { type: "number" },
          },
          required: ["name", "protein_g", "calories_kcal", "estimated_cost_usd"],
          additionalProperties: false,
        },
        swaps: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short swap title, e.g. '1 cup lentils + 100g paneer'" },
              creative_title: { type: "string", description: "A catchy, creative, unique 2–4 word dish name for this swap. Evocative and appetizing — NEVER just restate the ingredients (e.g., good: 'Hearth & Harvest Bowl', 'Lean Catch Plate', 'Omega Boost Stack'; bad: '1 lb tilapia + chia seeds'). No emojis. Title Case. Must be unique across the 3 swaps in this response." },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    food: { type: "string" },
                    portion: { type: "string" },
                  },
                  required: ["food", "portion"],
                  additionalProperties: false,
                },
              },
              protein_g: { type: "number" },
              calories_kcal: { type: "number" },
              estimated_cost_usd: { type: "number" },
              savings_percent: { type: "number", description: "Estimated % saved vs the original" },
              notes: { type: "string", description: "1 short sentence: why this swap works nutritionally and which nutrients the add-ons cover." },
              nutrient_coverage: {
                type: "array",
                description: "Key nutrients this swap intentionally covers (especially when replacing meat with plants). E.g. 'B12', 'iron', 'zinc', 'omega-3', 'complete protein'.",
                items: { type: "string" },
              },
              glycemic_impact: {
                type: "string",
                enum: ["lower", "similar", "higher", "unknown"],
                description: "Estimated glycemic impact of this swap vs the original food. Only meaningful when blood_sugar_friendly mode is active; otherwise return 'unknown'.",
              },
              glycemic_tradeoff: {
                type: "string",
                description: "Short note when there is a glycemic tradeoff to flag (e.g. 'Cheaper, but similar glycemic impact'). Empty string if not relevant.",
              },
            },
            required: ["title", "creative_title", "items", "protein_g", "calories_kcal", "estimated_cost_usd", "savings_percent", "notes", "nutrient_coverage", "glycemic_impact", "glycemic_tradeoff"],
            additionalProperties: false,
          },
        },
      },
      required: ["original", "swaps"],
      additionalProperties: false,
    },
  },
};

// ISO week key, e.g. "2026-W19", used to bust price-sensitive caches weekly.
function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

type KrogerMatch = {
  product_name: string;
  brand?: string;
  size?: string;
  price_usd: number;
  on_sale: boolean;
  regular_price_usd?: number;
  image?: string | null;
};
type KrogerResp = {
  store?: { id: string; name: string; chain: string } | null;
  prices?: { item: string; match: KrogerMatch | null }[];
  total_usd?: number;
  error?: string;
};

async function fetchKrogerPrices(zip: string, items: string[], authHeader: string | null): Promise<KrogerResp | null> {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/kroger-prices`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authHeader) headers["Authorization"] = authHeader;
    else {
      const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
      if (anon) headers["Authorization"] = `Bearer ${anon}`;
    }
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ zip, items }) });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.warn("kroger-prices call failed:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authHeader = req.headers.get("Authorization");
  const userId = await getUserIdFromAuth(req);
  if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const startedAt = Date.now();
  try {
    const { food, dietary_prefs = [], profile = null, cuisine = null, blood_sugar_friendly = false, zip = null } = await req.json();
    if (!food) return new Response(JSON.stringify({ error: "Missing 'food'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const weekKey = isoWeekKey();
    const cacheKey = await stableHash({ v: 2, food: String(food).toLowerCase().trim(), dietary_prefs, profile, cuisine, blood_sugar_friendly: !!blood_sugar_friendly, zip: zip ?? null, week: weekKey });
    const cached = await cacheGet(FN, cacheKey);
    if (cached) {
      logAiUsage({ userId, functionName: FN, model: MODEL, cached: true, latencyMs: Date.now() - startedAt });
      return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prefs = Array.isArray(dietary_prefs) ? dietary_prefs.join(", ") : "";
    const prefsLower = (Array.isArray(dietary_prefs) ? dietary_prefs : []).map((p: string) => String(p).toLowerCase());
    const isHalal = prefsLower.includes("halal");
    const isKosher = prefsLower.includes("kosher");
    const halalKosherMeat = isHalal || isKosher;

    const profileLines: string[] = [];
    if (profile) {
      if (Array.isArray(profile.cuisines) && profile.cuisines.length) profileLines.push(`Favorite cuisines: ${profile.cuisines.join(", ")}.`);
      if (profile.spice) profileLines.push(`Spice tolerance: ${profile.spice}.`);
      if (Array.isArray(profile.loves) && profile.loves.length) profileLines.push(`Foods they love (prefer these in swaps): ${profile.loves.join(", ")}.`);
      if (Array.isArray(profile.dislikes) && profile.dislikes.length) profileLines.push(`Foods they dislike (avoid): ${profile.dislikes.join(", ")}.`);
      if (Array.isArray(profile.allergies) && profile.allergies.length) profileLines.push(`ALLERGIES — STRICTLY EXCLUDE: ${profile.allergies.join(", ")}.`);
    }
    const cuisineBlock = cuisine ? `\nLean swaps toward ${cuisine} cuisine when natural.` : "";
    const bloodSugarBlock = blood_sugar_friendly
      ? "\nBLOOD SUGAR MODE: The user wants alternatives that are friendlier to blood sugar. Prioritize alternatives with lower glycemic index (GI) and/or lower glycemic load (GL) than the original. Favor options with more fiber, more protein, or healthier fats that moderate blood sugar response. Cheaper-alternative logic still applies — try to satisfy both. For each swap, set `glycemic_impact` to 'lower' (meaningfully better GI/GL than original), 'similar' (about the same), 'higher' (worse), or 'unknown' (insufficient info). If a cheaper alternative has similar or higher glycemic impact than the original, set `glycemic_tradeoff` to a short, transparent note like 'Cheaper, but similar glycemic impact'. Do not make medical claims."
      : "\nBlood sugar mode is OFF — set `glycemic_impact` to 'unknown' and leave `glycemic_tradeoff` empty.";

    const priceAnchors = [
      "PRICE ANCHORS — current US grocery prices (2025–2026). Use these as your baseline; do NOT use older training data.",
      "Meat & poultry (regular, per lb):",
      "  - Whole chicken: ~$2.50–3.50",
      "  - Chicken breast (boneless): ~$5–6",
      "  - Chicken thighs (boneless): ~$4–5",
      "  - Ground beef (80/20): ~$6–7",
      "  - Ground beef (lean 90/10): ~$7–9",
      "  - Beef chuck/stew: ~$7–9",
      "  - Beef sirloin/strip steak: ~$11–15",
      "  - Pork shoulder: ~$3–4    Pork chops: ~$4–6",
      "  - Lamb (regular, leg/shoulder): ~$9–11    Ground lamb: ~$9–11",
      "  - Salmon fillet: ~$11–14    Tilapia/cod: ~$6–9    Canned tuna (5oz): ~$1.50",
      "  - Eggs (per dozen large): ~$3.50–5",
      "Plant proteins:",
      "  - Dry lentils/black beans/chickpeas (per lb): ~$1.50–2.50",
      "  - Canned beans (15oz): ~$1.20–1.80",
      "  - Tofu (14oz block): ~$2.50–3.50    Tempeh (8oz): ~$3.50–4.50",
      "  - Peanut butter (per lb): ~$3–4    Greek yogurt (32oz): ~$5–6",
      "Pantry add-ons:",
      "  - Walnuts/almonds (per lb): ~$8–10    Pumpkin/sunflower seeds (per lb): ~$5–7",
      "  - Flax/chia seeds (per lb): ~$4–6    Nutritional yeast (per oz): ~$0.80",
      "  - Rice (per lb): ~$1–1.50    Quinoa (per lb): ~$3–4    Oats (per lb): ~$1.50",
    ].join("\n");

    const halalKosherBlock = halalKosherMeat
      ? [
          "",
          "HALAL/KOSHER MEAT PREMIUM — CRITICAL for cost accuracy:",
          "Halal- and kosher-certified meat costs roughly 25–30% MORE than the regular prices above because of certified slaughter, supervision, and limited supplier networks.",
          "Apply a 1.25–1.30× multiplier to ALL meat and poultry prices when sourcing must be halal/kosher.",
          "Examples (halal/kosher pricing the user will actually pay):",
          "  - Halal/kosher lamb: ~$12–14/lb (not $9–11)",
          "  - Halal/kosher ground beef: ~$7.50–10/lb",
          "  - Halal/kosher chicken breast: ~$6–8/lb",
          "  - Halal/kosher whole chicken: ~$3–5/lb",
          "  - Halal/kosher beef steak: ~$14–20/lb",
          "Apply this premium to BOTH the original food's estimated_cost_usd AND any swap that still uses meat. Cheaper plant-based or chicken-based swaps become even more compelling under this premium — reflect that in savings_percent.",
        ].join("\n")
      : "";

    const profileBlock = (profileLines.length ? `\nUser food profile:\n${profileLines.join("\n")}` : "") + cuisineBlock + bloodSugarBlock;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: [
            "You are a nutrition equivalency engine. Given a food + portion, return 3 alternative combinations that match protein and calories within ~15% but typically cost less.",
            "USE THE PRICE ANCHORS BELOW as ground truth for estimated_cost_usd. Your training data is older and underestimates current grocery costs — do not rely on it for prices.",
            priceAnchors,
            halalKosherBlock,
            "Dietary restrictions: halal = no pork or alcohol, meat must be halal-sourced; kosher = no pork/shellfish, never combine meat with dairy in one swap; vegetarian = no meat or fish; vegan = no animal products at all.",
            "NUTRIENT COMPENSATION RULE — this is critical. When the original is animal protein (meat, poultry, fish, eggs) and you swap to plants (legumes, lentils, beans, tofu, tempeh, grains), legumes alone are NOT a complete substitute. You MUST add small amounts of complementary foods to cover what plants typically lack:",
            "- Complete amino acids: pair legumes with a grain (rice, quinoa, whole-wheat) OR add a small amount of dairy/egg/soy.",
            "- Vitamin B12: include dairy, eggs, nutritional yeast, or fortified plant milk (B12 is absent in pure plant foods).",
            "- Iron + zinc: add pumpkin seeds, cashews, lentils with vitamin-C source (lemon, tomato, bell pepper) to boost absorption.",
            "- Omega-3: add a tablespoon of walnuts, flax, chia, or hemp seeds.",
            "- Calcium (if replacing dairy too): tahini, fortified plant milk, or leafy greens.",
            "Use cheap pantry add-ons (a tbsp of seeds, a handful of nuts, a fortified item) so savings are preserved. In `nutrient_coverage`, list the specific nutrients the add-ons restore. In `notes`, briefly explain WHY the add-on is there (e.g., 'walnuts add omega-3 that lentils lack').",
            "CREATIVE TITLES: For each swap, invent a catchy, appetizing 2–4 word dish name in Title Case for `creative_title`. Make it evocative (e.g., 'Hearth & Harvest Bowl', 'Lean Catch Plate', 'Golden Lentil Skillet', 'Omega Boost Stack'). NEVER restate the ingredient list. All 3 swaps must have distinct creative titles. No emojis. The `title` field stays as the literal ingredient summary.",
            "Be practical and money-conscious, never moralizing. Never make medical claims. Always call return_swaps.",
          ].filter(Boolean).join("\n\n") },
          { role: "user", content: `Find swaps for: ${food}\nDietary restrictions: ${prefs || "none"}${profileBlock}` },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_swaps" } },
      }),
    });
    if (!resp.ok) {
      const status = resp.status;
      logAiUsage({ userId, functionName: FN, model: MODEL, status: "error", error: `gateway ${status}`, latencyMs: Date.now() - startedAt });
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit hit — try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      logAiUsage({ userId, functionName: FN, model: MODEL, status: "error", error: "no tool args", latencyMs: Date.now() - startedAt });
      return new Response(JSON.stringify({ error: "No structured response" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const parsed = JSON.parse(args);

    // ----- Kroger price grounding -----
    // Halal/kosher meat is rarely on Kroger shelves under those labels, so skip
    // Kroger overrides for the original food in that case (estimate stays). We
    // still ground swap items that don't require certified meat.
    let priceSource: "estimate" | "kroger" | "mixed" = "estimate";
    let storeLabel: string | null = null;
    if (zip && /^\d{5}$/.test(String(zip))) {
      try {
        const groundOriginal = !halalKosherMeat;
        const itemsToPrice: { key: string; term: string }[] = [];
        if (groundOriginal) itemsToPrice.push({ key: "__original__", term: String(parsed.original?.name ?? food) });
        for (let i = 0; i < (parsed.swaps?.length ?? 0); i++) {
          const swap = parsed.swaps[i];
          // Skip kroger lookup for swaps whose items are still certified meat under restrictions
          const stillCertified = halalKosherMeat && swap.items?.some((it: any) => /\b(beef|lamb|chicken|turkey|veal|goat)\b/i.test(String(it.food)));
          if (stillCertified) continue;
          for (let j = 0; j < swap.items.length; j++) {
            itemsToPrice.push({ key: `swap_${i}_${j}`, term: String(swap.items[j].food) });
          }
        }
        if (itemsToPrice.length) {
          const kr = await fetchKrogerPrices(String(zip), itemsToPrice.map((x) => x.term), authHeader);
          if (kr?.store && Array.isArray(kr.prices)) {
            storeLabel = kr.store.name;
            const lookup = new Map<string, KrogerMatch | null>();
            kr.prices.forEach((p, idx) => lookup.set(itemsToPrice[idx].key, p.match ?? null));

            // Override original cost if grounded
            if (groundOriginal) {
              const m = lookup.get("__original__");
              if (m?.price_usd) {
                parsed.original.estimated_cost_usd = Number(m.price_usd.toFixed(2));
                priceSource = "kroger";
              }
            }
            // Sum swap items
            for (let i = 0; i < (parsed.swaps?.length ?? 0); i++) {
              const swap = parsed.swaps[i];
              let total = 0;
              let allMatched = true;
              for (let j = 0; j < swap.items.length; j++) {
                const m = lookup.get(`swap_${i}_${j}`);
                if (m?.price_usd) total += m.price_usd;
                else { allMatched = false; break; }
              }
              if (allMatched && total > 0) {
                swap.estimated_cost_usd = Number(total.toFixed(2));
                priceSource = priceSource === "estimate" ? "kroger" : priceSource;
              } else if (priceSource === "kroger") {
                priceSource = "mixed";
              }
            }
            // Recompute savings_percent off (possibly updated) original
            const orig = Number(parsed.original?.estimated_cost_usd ?? 0);
            if (orig > 0) {
              for (const swap of parsed.swaps ?? []) {
                const c = Number(swap.estimated_cost_usd ?? 0);
                swap.savings_percent = c > 0 ? Math.max(0, Math.round(((orig - c) / orig) * 100)) : 0;
              }
            }
          }
        }
      } catch (e) {
        console.warn("kroger grounding skipped:", e);
      }
    }

    parsed.price_source = priceSource;
    parsed.price_store = storeLabel;

    // ----- Regional cost-of-living adjustment -----
    // Inline so we don't need a shared module. Scale BOTH original and swap
    // costs by the same factor so savings_percent stays identical.
    const STATE_MULT: Record<string, { label: string; mult: number }> = {
      HI: { label: "Hawaii", mult: 1.30 },
      AK: { label: "Alaska", mult: 1.27 },
      CA: { label: "California", mult: 1.13 },
      NY: { label: "New York", mult: 1.13 },
      MA: { label: "Massachusetts", mult: 1.10 },
      DC: { label: "Washington, DC", mult: 1.10 },
      WA: { label: "Washington", mult: 1.08 },
      NJ: { label: "New Jersey", mult: 1.08 },
      CT: { label: "Connecticut", mult: 1.08 },
      OR: { label: "Oregon", mult: 1.06 },
      VT: { label: "Vermont", mult: 1.05 },
      MD: { label: "Maryland", mult: 1.05 },
      RI: { label: "Rhode Island", mult: 1.05 },
      NH: { label: "New Hampshire", mult: 1.04 },
      CO: { label: "Colorado", mult: 1.04 },
    };
    const zip3Ranges: [number, number, string][] = [
      [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [50, 59, "VT"],
      [60, 69, "CT"], [70, 89, "NJ"], [100, 149, "NY"], [200, 205, "DC"],
      [206, 219, "MD"], [800, 816, "CO"], [900, 961, "CA"], [967, 968, "HI"],
      [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"],
    ];
    const stateFromZip = (z: string | null): string | null => {
      if (!z || !/^\d{5}/.test(z)) return null;
      const p = parseInt(z.slice(0, 3), 10);
      for (const [lo, hi, st] of zip3Ranges) if (p >= lo && p <= hi) return st;
      return null;
    };
    const regionState = stateFromZip(zip ? String(zip) : null);
    const regionInfo = regionState ? STATE_MULT[regionState] : null;
    if (regionInfo && regionInfo.mult > 1) {
      const m = regionInfo.mult;
      if (parsed.original?.estimated_cost_usd) {
        parsed.original.estimated_cost_usd = Number((parsed.original.estimated_cost_usd * m).toFixed(2));
      }
      for (const swap of parsed.swaps ?? []) {
        if (swap.estimated_cost_usd) {
          swap.estimated_cost_usd = Number((swap.estimated_cost_usd * m).toFixed(2));
        }
      }
      parsed.region_state = regionState;
      parsed.region_label = regionInfo.label;
      parsed.region_multiplier = m;
    } else {
      parsed.region_state = regionState;
      parsed.region_label = null;
      parsed.region_multiplier = 1;
    }

    const usage = data?.usage ?? {};
    logAiUsage({
      userId, functionName: FN, model: MODEL,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      latencyMs: Date.now() - startedAt,
    });
    // 24h cache (was 7 days). Weekly bucket already in cache key for prices.
    cachePut(FN, cacheKey, parsed, 24);
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("equivalency error:", e);
    logAiUsage({ userId, functionName: FN, model: MODEL, status: "error", error: e instanceof Error ? e.message : "unknown", latencyMs: Date.now() - startedAt });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
