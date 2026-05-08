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
            },
            required: ["title", "items", "protein_g", "calories_kcal", "estimated_cost_usd", "savings_percent", "notes", "nutrient_coverage"],
            additionalProperties: false,
          },
        },
      },
      required: ["original", "swaps"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const userId = await getUserIdFromAuth(req);
  const startedAt = Date.now();
  try {
    const { food, dietary_prefs = [], profile = null, cuisine = null } = await req.json();
    if (!food) return new Response(JSON.stringify({ error: "Missing 'food'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const cacheKey = await stableHash({ food: String(food).toLowerCase().trim(), dietary_prefs, profile, cuisine });
    const cached = await cacheGet(FN, cacheKey);
    if (cached) {
      logAiUsage({ userId, functionName: FN, model: MODEL, cached: true, latencyMs: Date.now() - startedAt });
      return new Response(JSON.stringify(cached), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prefs = Array.isArray(dietary_prefs) ? dietary_prefs.join(", ") : "";
    const profileLines: string[] = [];
    if (profile) {
      if (Array.isArray(profile.cuisines) && profile.cuisines.length) profileLines.push(`Favorite cuisines: ${profile.cuisines.join(", ")}.`);
      if (profile.spice) profileLines.push(`Spice tolerance: ${profile.spice}.`);
      if (Array.isArray(profile.loves) && profile.loves.length) profileLines.push(`Foods they love (prefer these in swaps): ${profile.loves.join(", ")}.`);
      if (Array.isArray(profile.dislikes) && profile.dislikes.length) profileLines.push(`Foods they dislike (avoid): ${profile.dislikes.join(", ")}.`);
      if (Array.isArray(profile.allergies) && profile.allergies.length) profileLines.push(`ALLERGIES — STRICTLY EXCLUDE: ${profile.allergies.join(", ")}.`);
    }
    const profileBlock = profileLines.length ? `\nUser food profile:\n${profileLines.join("\n")}` : "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: [
            "You are a nutrition equivalency engine. Given a food + portion, return 3 alternative combinations that match protein and calories within ~15% but typically cost less. Use realistic US grocery prices.",
            "Dietary restrictions: halal = no pork or alcohol, meat must be halal-sourced; kosher = no pork/shellfish, never combine meat with dairy in one swap; vegetarian = no meat or fish; vegan = no animal products at all.",
            "NUTRIENT COMPENSATION RULE — this is critical. When the original is animal protein (meat, poultry, fish, eggs) and you swap to plants (legumes, lentils, beans, tofu, tempeh, grains), legumes alone are NOT a complete substitute. You MUST add small amounts of complementary foods to cover what plants typically lack:",
            "- Complete amino acids: pair legumes with a grain (rice, quinoa, whole-wheat) OR add a small amount of dairy/egg/soy.",
            "- Vitamin B12: include dairy, eggs, nutritional yeast, or fortified plant milk (B12 is absent in pure plant foods).",
            "- Iron + zinc: add pumpkin seeds, cashews, lentils with vitamin-C source (lemon, tomato, bell pepper) to boost absorption.",
            "- Omega-3: add a tablespoon of walnuts, flax, chia, or hemp seeds.",
            "- Calcium (if replacing dairy too): tahini, fortified plant milk, or leafy greens.",
            "Use cheap pantry add-ons (a tbsp of seeds, a handful of nuts, a fortified item) so savings are preserved. In `nutrient_coverage`, list the specific nutrients the add-ons restore. In `notes`, briefly explain WHY the add-on is there (e.g., 'walnuts add omega-3 that lentils lack').",
            "Be practical and money-conscious, never moralizing. Always call return_swaps.",
          ].join(" ") },
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
    const usage = data?.usage ?? {};
    logAiUsage({
      userId, functionName: FN, model: MODEL,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      latencyMs: Date.now() - startedAt,
    });
    cachePut(FN, cacheKey, parsed, 24 * 7);
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("equivalency error:", e);
    logAiUsage({ userId, functionName: FN, model: MODEL, status: "error", error: e instanceof Error ? e.message : "unknown", latencyMs: Date.now() - startedAt });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
