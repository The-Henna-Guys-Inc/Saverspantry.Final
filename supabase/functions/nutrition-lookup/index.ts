// Nutrition lookup — USDA FoodData Central as primary source, AI fallback + portion parsing
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { cacheGet, cachePut, getUserIdFromAuth, logAiUsage, stableHash } from "../_shared/aiUsage.ts";

const FN = "nutrition-lookup";
const MODEL = "google/gemini-2.5-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ----- Tool: parse a free-text query into a normalized food + grams -----
const PARSE_TOOL = {
  type: "function",
  function: {
    name: "parse_portion",
    description: "Parse a natural-language food query into a clean food name and total grams.",
    parameters: {
      type: "object",
      properties: {
        food_name: { type: "string", description: "Clean food name suitable for a nutrition database search, e.g. 'chia seeds', 'cooked quinoa', 'paneer'." },
        serving_grams: { type: "number", description: "Total grams represented by the user's portion." },
        portion_label: { type: "string", description: "Human-friendly portion label, e.g. '2 tbsp (24g)'." },
      },
      required: ["food_name", "serving_grams", "portion_label"],
      additionalProperties: false,
    },
  },
};

// ----- Tool: AI-only fallback nutrition (used when USDA returns nothing) -----
const NUTRITION_TOOL = {
  type: "function",
  function: {
    name: "return_nutrition",
    description: "Return nutrition facts for the queried food/portion.",
    parameters: {
      type: "object",
      properties: {
        food: { type: "string" },
        serving_grams: { type: "number" },
        calories_kcal: { type: "number" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fiber_g: { type: "number" },
        fat_g: { type: "number" },
        key_micros: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              amount: { type: "number" },
              unit: { type: "string" },
              dv_percent: { type: "number" },
            },
            required: ["name", "amount", "unit"],
            additionalProperties: false,
          },
        },
        notes: { type: "string" },
      },
      required: ["food", "serving_grams", "calories_kcal", "protein_g", "carbs_g", "fiber_g", "fat_g", "key_micros", "notes"],
      additionalProperties: false,
    },
  },
};

// ----- Tool: friendly note generator (after USDA gives us numbers) -----
const NOTE_TOOL = {
  type: "function",
  function: {
    name: "return_note",
    description: "One short, friendly money-saving or swap tip about the food. Never moralize.",
    parameters: {
      type: "object",
      properties: { notes: { type: "string" } },
      required: ["notes"],
      additionalProperties: false,
    },
  },
};

// USDA FDC nutrient IDs we care about (standard FDC nutrient.id values)
const N = {
  ENERGY_KCAL: 1008,
  PROTEIN: 1003,
  CARBS: 1005,
  FIBER: 1079,
  FAT: 1004,
};

// Micros worth surfacing — id -> {name, dv (daily value for adults)}
const MICRO_DVS: Record<number, { name: string; unit: string; dv: number }> = {
  1087: { name: "Calcium",   unit: "mg", dv: 1300 },
  1089: { name: "Iron",      unit: "mg", dv: 18 },
  1090: { name: "Magnesium", unit: "mg", dv: 420 },
  1092: { name: "Potassium", unit: "mg", dv: 4700 },
  1093: { name: "Sodium",    unit: "mg", dv: 2300 },
  1095: { name: "Zinc",      unit: "mg", dv: 11 },
  1162: { name: "Vitamin C", unit: "mg", dv: 90 },
  1109: { name: "Vitamin E", unit: "mg", dv: 15 },
  1185: { name: "Vitamin K", unit: "µg", dv: 120 },
  1114: { name: "Vitamin D", unit: "µg", dv: 20 },
  1106: { name: "Vitamin A (RAE)", unit: "µg", dv: 900 },
  1165: { name: "Thiamin",   unit: "mg", dv: 1.2 },
  1166: { name: "Riboflavin",unit: "mg", dv: 1.3 },
  1167: { name: "Niacin",    unit: "mg", dv: 16 },
  1175: { name: "Vitamin B6",unit: "mg", dv: 1.7 },
  1177: { name: "Folate",    unit: "µg", dv: 400 },
  1178: { name: "Vitamin B12", unit: "µg", dv: 2.4 },
};

// Nutrient resolver for "top foods by nutrient" queries.
// Maps a normalized nutrient key to one or more USDA FDC nutrient IDs (summed) + display unit.
const NUTRIENT_MAP: Record<string, { label: string; ids: number[]; unit: string }> = {
  "omega-3":     { label: "Omega-3 (ALA+EPA+DHA)", ids: [1404, 1278, 1272], unit: "g" },
  "omega-6":     { label: "Omega-6 (LA+AA)",       ids: [1316, 1408],       unit: "g" },
  "protein":     { label: "Protein",   ids: [1003], unit: "g" },
  "fiber":       { label: "Fiber",     ids: [1079], unit: "g" },
  "iron":        { label: "Iron",      ids: [1089], unit: "mg" },
  "calcium":     { label: "Calcium",   ids: [1087], unit: "mg" },
  "potassium":   { label: "Potassium", ids: [1092], unit: "mg" },
  "magnesium":   { label: "Magnesium", ids: [1090], unit: "mg" },
  "zinc":        { label: "Zinc",      ids: [1095], unit: "mg" },
  "vitamin c":   { label: "Vitamin C", ids: [1162], unit: "mg" },
  "vitamin d":   { label: "Vitamin D", ids: [1114], unit: "µg" },
  "vitamin e":   { label: "Vitamin E", ids: [1109], unit: "mg" },
  "vitamin k":   { label: "Vitamin K", ids: [1185], unit: "µg" },
  "vitamin a":   { label: "Vitamin A", ids: [1106], unit: "µg" },
  "vitamin b6":  { label: "Vitamin B6",ids: [1175], unit: "mg" },
  "vitamin b12": { label: "Vitamin B12", ids: [1178], unit: "µg" },
  "folate":      { label: "Folate",    ids: [1177], unit: "µg" },
  "selenium":    { label: "Selenium",  ids: [1103], unit: "µg" },
  "choline":     { label: "Choline",   ids: [1180], unit: "mg" },
};

function resolveNutrient(input: string): { key: string; meta: typeof NUTRIENT_MAP[string] } | null {
  const q = input.toLowerCase().trim();
  if (NUTRIENT_MAP[q]) return { key: q, meta: NUTRIENT_MAP[q] };
  for (const [k, meta] of Object.entries(NUTRIENT_MAP)) {
    if (q.includes(k) || k.includes(q)) return { key: k, meta };
  }
  return null;
}

// ----- Tool: classify the user's query -----
const INTENT_TOOL = {
  type: "function",
  function: {
    name: "classify_query",
    description: "Decide if the user is asking for nutrition of ONE specific food/portion, or asking for a RANKING of foods highest in a nutrient.",
    parameters: {
      type: "object",
      properties: {
        intent: { type: "string", enum: ["single_food", "top_foods"] },
        nutrient: { type: "string", description: "If intent=top_foods, the nutrient name in lowercase, e.g. 'omega-3', 'protein', 'iron', 'vitamin c'. Empty string otherwise." },
      },
      required: ["intent", "nutrient"],
      additionalProperties: false,
    },
  },
};

// ----- Tool: ranked candidate foods for a nutrient -----
const RANK_TOOL = {
  type: "function",
  function: {
    name: "return_top_foods",
    description: "Return 6 candidate whole foods that are well-known top dietary sources of the requested nutrient, with realistic single-serving portions in grams. Prefer accessible US-grocery foods. Use USDA-grade values.",
    parameters: {
      type: "object",
      properties: {
        nutrient_label: { type: "string" },
        unit: { type: "string", description: "Display unit, e.g. 'g', 'mg', 'µg'." },
        candidates: {
          type: "array",
          minItems: 6,
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              food_name:     { type: "string", description: "Clean food name suitable for USDA search, e.g. 'flax seeds, ground', 'salmon, atlantic, cooked', 'chia seeds'." },
              portion_label: { type: "string", description: "Human-friendly serving, e.g. '1 tbsp (10g)', '3 oz (85g)'." },
              portion_grams: { type: "number", description: "Total grams of the portion." },
              estimated_amount: { type: "number", description: "Estimated nutrient amount in `unit` per the portion." },
            },
            required: ["food_name", "portion_label", "portion_grams", "estimated_amount"],
            additionalProperties: false,
          },
        },
      },
      required: ["nutrient_label", "unit", "candidates"],
      additionalProperties: false,
    },
  },
};


function getNutrient(food: any, id: number): number {
  const fns = food?.foodNutrients ?? [];
  const hit = fns.find((n: any) => (n?.nutrient?.id ?? n?.nutrientId) === id);
  if (!hit) return 0;
  // /food/{id} returns { amount, nutrient:{...} } per 100g; /foods/search returns { value }
  return Number(hit.amount ?? hit.value ?? 0);
}

async function callAI(messages: any[], tool: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    const err: any = new Error(`gateway ${resp.status}: ${text}`);
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("No tool call in AI response");
  return { args: JSON.parse(call.function.arguments), usage: data?.usage ?? {} };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const userId = await getUserIdFromAuth(req);
  const startedAt = Date.now();

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'query' string" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKey = await stableHash({ q: query.toLowerCase().trim(), v: "usda2" });
    const cached = await cacheGet<{ nutrition?: unknown; ranking?: unknown }>(FN, cacheKey);
    if (cached) {
      logAiUsage({ userId, functionName: FN, model: MODEL, cached: true, latencyMs: Date.now() - startedAt });
      return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const USDA_API_KEY = Deno.env.get("USDA_API_KEY");

    // 0) Classify intent — single food lookup vs "top foods by nutrient" ranking
    let intent: "single_food" | "top_foods" = "single_food";
    let nutrientHint = "";
    try {
      const { args } = await callAI(
        [
          { role: "system", content: "Classify the user's nutrition query. 'top_foods' means they're asking which foods are highest/best/richest in a nutrient (e.g. 'foods with most omega-3', 'highest protein foods', 'best source of iron'). 'single_food' means they're asking nutrition facts for one food/portion. Always call classify_query." },
          { role: "user", content: query },
        ],
        INTENT_TOOL,
      );
      intent = args?.intent === "top_foods" ? "top_foods" : "single_food";
      nutrientHint = (args?.nutrient ?? "").toLowerCase().trim();
    } catch (e: any) {
      console.warn("intent classification failed:", e?.message);
    }

    // ===== TOP FOODS RANKING PATH =====
    if (intent === "top_foods") {
      const resolved = resolveNutrient(nutrientHint || query);
      try {
        const { args, usage } = await callAI(
          [
            { role: "system", content: `You list 6 whole foods that are well-established top dietary sources of the requested nutrient. Use realistic single-serving portions (e.g. 1 tbsp seeds ≈ 10g, 3 oz fish ≈ 85g, 1 cup cooked beans ≈ 170g). Use USDA-grade values for the estimated amount per portion. Display unit should be ${resolved?.meta.unit ?? "g/mg/µg as appropriate"}. Always call return_top_foods.` },
            { role: "user", content: `Top foods highest in: ${nutrientHint || query}` },
          ],
          RANK_TOOL,
        );
        logAiUsage({ userId, functionName: FN + ":rank", model: MODEL, promptTokens: usage.prompt_tokens ?? 0, completionTokens: usage.completion_tokens ?? 0, latencyMs: Date.now() - startedAt });

        const unit = resolved?.meta.unit ?? args.unit ?? "g";
        const nutrientLabel = resolved?.meta.label ?? args.nutrient_label ?? nutrientHint;

        // Verify each candidate against USDA — sequential to avoid USDA rate limits
        const verified: any[] = [];
        for (const c of (args.candidates as any[]).slice(0, 6)) {
          let amount = Number(c.estimated_amount) || 0;
          let source: "USDA" | "AI estimate" = "AI estimate";
          if (USDA_API_KEY && resolved) {
            // Fatty-acid IDs aren't broken out in FNDDS — use Foundation+SR Legacy only for those.
            const isFattyAcid = resolved.meta.ids.some((id) => id >= 1257 && id <= 1410);
            const dataType = isFattyAcid
              ? "Foundation,SR%20Legacy"
              : "Foundation,SR%20Legacy,Survey%20%28FNDDS%29";
            const tryQuery = async (q: string, useFilter = true) => {
              const filter = useFilter ? `&dataType=${dataType}` : "";
              const sUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(q)}&pageSize=3${filter}`;
              const sRes = await fetch(sUrl);
              if (!sRes.ok) return null;
              const sJson = await sRes.json();
              return sJson?.foods?.[0] ?? null;
            };
            try {
              // 1st: full name; 2nd: simplified before comma; 3rd: simplified, no dataType filter
              let top = await tryQuery(c.food_name);
              const simple = String(c.food_name).split(/[,(]/)[0].trim();
              if (!top?.fdcId && simple && simple !== c.food_name) top = await tryQuery(simple);
              if (!top?.fdcId) top = await tryQuery(simple || c.food_name, false);
              if (top?.fdcId) {
                const dRes = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${top.fdcId}?api_key=${USDA_API_KEY}`);
                if (dRes.ok) {
                  const food = await dRes.json();
                  const factor = Math.max(1, Number(c.portion_grams) || 100) / 100;
                  let per100 = 0;
                  for (const id of resolved.meta.ids) per100 += getNutrient(food, id);
                  const usdaAmt = per100 * factor;
                  const aiAmt = Number(c.estimated_amount) || 0;
                  // Sanity guard: if USDA is wildly off vs AI estimate (>3x or <1/3),
                  // the search likely matched a different food (e.g. soybean → soybean oil).
                  // In that case keep the AI estimate.
                  const ratio = aiAmt > 0 ? usdaAmt / aiAmt : 1;
                  const trustworthy = per100 > 0 && (aiAmt === 0 || (ratio >= 0.33 && ratio <= 3));
                  console.log(`[verify] ${c.food_name} → ${top.fdcId} (${top.description}); usda=${usdaAmt.toFixed(2)} ai=${aiAmt} trust=${trustworthy}`);
                  if (trustworthy) {
                    amount = usdaAmt;
                    source = "USDA";
                  }
                }
              } else {
                console.warn(`[verify] no USDA hit for "${c.food_name}"`);
              }
            } catch (e: any) { console.warn("USDA verify failed for", c.food_name, e?.message); }
          }
          const decimals = unit === "g" ? 2 : unit === "mg" ? 1 : 0;
          verified.push({
            food: c.food_name,
            portion_label: c.portion_label,
            portion_grams: Number(c.portion_grams),
            amount: Number(amount.toFixed(decimals)),
            unit,
            source,
          });
        }

        const ranked = verified
          .filter((v) => v.amount > 0)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3);

        const ranking = {
          query,
          nutrient: nutrientLabel,
          unit,
          items: ranked,
          note: ranked.some((r) => r.source === "USDA")
            ? "Values verified against USDA FoodData Central where available."
            : "Values are AI estimates — USDA verification was unavailable for these foods.",
        };
        const result = { ranking };
        cachePut(FN, cacheKey, result, 24 * 30);
        logAiUsage({ userId, functionName: FN + ":rank:done", model: MODEL, latencyMs: Date.now() - startedAt });
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e: any) {
        const status = e?.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit hit — please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please try again later." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw e;
      }
    }



    // 1) Parse user's free-text query into food name + grams
    let parsed: { food_name: string; serving_grams: number; portion_label: string };
    try {
      const { args, usage } = await callAI(
        [
          { role: "system", content: "You parse natural-language food queries into a clean food name and the total grams the user described. Use standard household measure conversions (e.g. 1 tbsp chia ≈ 12g, 1 cup cooked quinoa ≈ 185g, 1 medium banana ≈ 118g). Always call parse_portion." },
          { role: "user", content: query },
        ],
        PARSE_TOOL,
      );
      parsed = args;
      logAiUsage({ userId, functionName: FN + ":parse", model: MODEL, promptTokens: usage.prompt_tokens ?? 0, completionTokens: usage.completion_tokens ?? 0, latencyMs: Date.now() - startedAt });
    } catch (e: any) {
      console.error("parse failed", e?.message);
      parsed = { food_name: query, serving_grams: 100, portion_label: query };
    }

    let nutrition: any = null;
    let source: "usda" | "ai" = "ai";

    // 2) Try USDA FDC
    if (USDA_API_KEY) {
      try {
        const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(parsed.food_name)}&pageSize=5&dataType=Foundation,SR%20Legacy,Survey%20%28FNDDS%29`;
        const sRes = await fetch(searchUrl);
        if (sRes.ok) {
          const sJson = await sRes.json();
          const top = sJson?.foods?.[0];
          if (top?.fdcId) {
            const dRes = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${top.fdcId}?api_key=${USDA_API_KEY}`);
            if (dRes.ok) {
              const food = await dRes.json();
              const g = Math.max(1, Number(parsed.serving_grams) || 100);
              const factor = g / 100; // FDC values are per 100g
              const macros = {
                calories_kcal: getNutrient(food, N.ENERGY_KCAL) * factor,
                protein_g:     getNutrient(food, N.PROTEIN) * factor,
                carbs_g:       getNutrient(food, N.CARBS) * factor,
                fiber_g:       getNutrient(food, N.FIBER) * factor,
                fat_g:         getNutrient(food, N.FAT) * factor,
              };
              // pick top 3 micros by % DV
              const micros = Object.entries(MICRO_DVS).map(([idStr, meta]) => {
                const id = Number(idStr);
                const amt = getNutrient(food, id) * factor;
                if (!amt || amt <= 0) return null;
                return { name: meta.name, amount: Number(amt.toFixed(2)), unit: meta.unit, dv_percent: (amt / meta.dv) * 100 };
              }).filter(Boolean) as any[];
              micros.sort((a, b) => (b.dv_percent ?? 0) - (a.dv_percent ?? 0));
              const key_micros = micros.slice(0, 3).map(m => ({ ...m, dv_percent: Math.round(m.dv_percent) }));

              // friendly note via AI (best-effort, non-fatal)
              let notes = "";
              try {
                const { args } = await callAI(
                  [
                    { role: "system", content: "Give one short (≤20 words), friendly, money-conscious tip or swap idea about this food. Never moralize. Always call return_note." },
                    { role: "user", content: `${parsed.food_name} (${parsed.portion_label})` },
                  ],
                  NOTE_TOOL,
                );
                notes = args?.notes ?? "";
              } catch { /* ignore */ }

              nutrition = {
                food: `${parsed.food_name} — ${parsed.portion_label}`,
                serving_grams: g,
                calories_kcal: Math.round(macros.calories_kcal),
                protein_g: Number(macros.protein_g.toFixed(1)),
                carbs_g: Number(macros.carbs_g.toFixed(1)),
                fiber_g: Number(macros.fiber_g.toFixed(1)),
                fat_g: Number(macros.fat_g.toFixed(1)),
                key_micros,
                notes,
                source: "USDA FoodData Central",
              };
              source = "usda";
            }
          }
        } else {
          console.warn("USDA search failed:", sRes.status, await sRes.text());
        }
      } catch (e: any) {
        console.warn("USDA error:", e?.message);
      }
    }

    // 3) AI fallback
    if (!nutrition) {
      try {
        const { args, usage } = await callAI(
          [
            { role: "system", content: "You are a precise nutrition database. Given a natural-language food query, return accurate macros and 2-4 standout micronutrients using USDA-style values. Be friendly and money-conscious in the notes. Always call return_nutrition." },
            { role: "user", content: query },
          ],
          NUTRITION_TOOL,
        );
        nutrition = { ...args, source: "AI estimate" };
        logAiUsage({ userId, functionName: FN, model: MODEL, promptTokens: usage.prompt_tokens ?? 0, completionTokens: usage.completion_tokens ?? 0, latencyMs: Date.now() - startedAt });
      } catch (e: any) {
        const status = e?.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit hit — please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please try again later." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw e;
      }
    }

    const result = { nutrition };
    cachePut(FN, cacheKey, result, 24 * 30);
    logAiUsage({ userId, functionName: FN + ":" + source, model: MODEL, latencyMs: Date.now() - startedAt });
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("nutrition-lookup error:", e);
    logAiUsage({ userId, functionName: FN, model: MODEL, status: "error", error: e instanceof Error ? e.message : "unknown", latencyMs: Date.now() - startedAt });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
