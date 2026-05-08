// AI Recipe generator from ingredients + cuisine
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { getUserIdFromAuth, logAiUsage } from "../_shared/aiUsage.ts";

const FN = "recipe-generate";
const MODEL = "google/gemini-2.5-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOL = {
  type: "function",
  function: {
    name: "return_recipe",
    description: "Return a recipe with steps, nutrition per serving, and estimated cost.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        cuisine: { type: "string" },
        servings: { type: "number" },
        time_minutes: { type: "number" },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item: { type: "string" },
              quantity: { type: "string" },
            },
            required: ["item", "quantity"],
            additionalProperties: false,
          },
        },
        steps: { type: "array", items: { type: "string" }, minItems: 3 },
        nutrition_per_serving: {
          type: "object",
          properties: {
            calories_kcal: { type: "number" },
            protein_g: { type: "number" },
            carbs_g: { type: "number" },
            fat_g: { type: "number" },
            fiber_g: { type: "number" },
            sodium_mg: { type: "number" },
          },
          required: ["calories_kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "sodium_mg"],
          additionalProperties: false,
        },
        estimated_total_cost_usd: { type: "number" },
        tip: { type: "string", description: "1 short money-saving or technique tip." },
        constraint_conflict: {
          type: "string",
          description: "Empty string if all user-supplied nutritional constraints are met. Otherwise a 1-sentence note explaining why a constraint couldn't realistically be met.",
        },
      },
      required: ["title", "cuisine", "servings", "time_minutes", "ingredients", "steps", "nutrition_per_serving", "estimated_total_cost_usd", "tip", "constraint_conflict"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const userId = await getUserIdFromAuth(req);
  const startedAt = Date.now();
  try {
    const {
      ingredients,
      cuisine,
      dietary_prefs = [],
      max_calories_per_serving,
      max_protein_g,
      max_sodium_mg,
      ai_notes,
    } = await req.json();
    if (!ingredients || !cuisine) return new Response(JSON.stringify({ error: "Missing ingredients or cuisine" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const prefs = Array.isArray(dietary_prefs) ? dietary_prefs.join(", ") : "";

    const constraintLines: string[] = [];
    if (typeof max_calories_per_serving === "number" && max_calories_per_serving > 0) constraintLines.push(`- Approximate maximum calories per serving: ${max_calories_per_serving} kcal`);
    if (typeof max_protein_g === "number" && max_protein_g > 0) constraintLines.push(`- Approximate maximum protein per serving: ${max_protein_g} g`);
    if (typeof max_sodium_mg === "number" && max_sodium_mg > 0) constraintLines.push(`- Approximate maximum sodium per serving: ${max_sodium_mg} mg`);
    const notes = typeof ai_notes === "string" ? ai_notes.trim().slice(0, 400) : "";

    let constraintBlock = "";
    if (constraintLines.length || notes) {
      constraintBlock = `\n\nNUTRITIONAL CONSTRAINTS (try to meet within ±10%):\n${constraintLines.join("\n") || "- (none)"}${notes ? `\n\nADDITIONAL NOTES FROM USER:\n${notes}` : ""}\n\nIf a constraint conflicts with the requested cuisine and ingredients (e.g. a 400-calorie biryani), generate the recipe authentically and explain the conflict in constraint_conflict. Do NOT silently violate the constraint. If all constraints are met, return constraint_conflict as an empty string.`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You are a friendly home cook. Generate one practical recipe for the given cuisine using mostly the available ingredients (assume basic pantry: salt, pepper, oil, common spices). Realistic US grocery prices. Strictly honor any dietary restrictions: halal = no pork or alcohol and meat must be halal-sourced; kosher = no pork/shellfish and never mix meat with dairy; vegetarian = no meat or fish. Nutrition values are approximate. Always call return_recipe." },
          { role: "user", content: `Cuisine: ${cuisine}\nAvailable ingredients: ${ingredients}\nDietary restrictions: ${prefs || "none"}${constraintBlock}` },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_recipe" } },
      }),
    });
    if (!resp.ok) {
      logAiUsage({ userId, functionName: FN, model: MODEL, status: "error", error: `gateway ${resp.status}`, latencyMs: Date.now() - startedAt });
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit hit — try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      logAiUsage({ userId, functionName: FN, model: MODEL, status: "error", error: "no tool args", latencyMs: Date.now() - startedAt });
      return new Response(JSON.stringify({ error: "No structured response" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const usage = data?.usage ?? {};
    logAiUsage({ userId, functionName: FN, model: MODEL, promptTokens: usage.prompt_tokens ?? 0, completionTokens: usage.completion_tokens ?? 0, latencyMs: Date.now() - startedAt });
    return new Response(JSON.stringify(JSON.parse(args)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("recipe error:", e);
    logAiUsage({ userId, functionName: FN, model: MODEL, status: "error", error: e instanceof Error ? e.message : "unknown", latencyMs: Date.now() - startedAt });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
