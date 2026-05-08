// AI Meal-plan generator: 7 days × (breakfast, lunch, dinner)
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MEAL = {
  type: "object",
  properties: {
    title: { type: "string" },
    main_ingredients: { type: "array", items: { type: "string" } },
    estimated_cost_usd: { type: "number" },
    time_minutes: { type: "number" },
  },
  required: ["title", "main_ingredients", "estimated_cost_usd", "time_minutes"],
  additionalProperties: false,
};

const DAY = {
  type: "object",
  properties: {
    day: { type: "string", description: "Mon, Tue, Wed, Thu, Fri, Sat, Sun" },
    breakfast: MEAL,
    lunch: MEAL,
    dinner: MEAL,
  },
  required: ["day", "breakfast", "lunch", "dinner"],
  additionalProperties: false,
};

const TOOL = {
  type: "function",
  function: {
    name: "return_meal_plan",
    description: "Return a 7-day meal plan with realistic US grocery costs.",
    parameters: {
      type: "object",
      properties: {
        days: { type: "array", items: DAY, minItems: 7, maxItems: 7 },
        total_estimated_cost_usd: { type: "number" },
        budget_tip: { type: "string" },
      },
      required: ["days", "total_estimated_cost_usd", "budget_tip"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { household_size = 2, dietary_prefs = [], budget_usd, cuisine_focus, diet_style, profile = null, must_include_recipes = [] } = await req.json().catch(() => ({}));
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const profileLines: string[] = [];
    if (profile) {
      if (Array.isArray(profile.cuisines) && profile.cuisines.length) profileLines.push(`Favorite cuisines: ${profile.cuisines.join(", ")}.`);
      if (profile.spice) profileLines.push(`Spice tolerance: ${profile.spice} — respect this in seasoning.`);
      if (Array.isArray(profile.loves) && profile.loves.length) profileLines.push(`Foods they love (work these in across the week): ${profile.loves.join(", ")}.`);
      if (Array.isArray(profile.dislikes) && profile.dislikes.length) profileLines.push(`Foods they dislike (do NOT use): ${profile.dislikes.join(", ")}.`);
      if (Array.isArray(profile.allergies) && profile.allergies.length) profileLines.push(`ALLERGIES — STRICTLY EXCLUDE from every meal: ${profile.allergies.join(", ")}.`);
    }
    const profileBlock = profileLines.length ? `\nUser food profile:\n${profileLines.join("\n")}` : "";
    const userMsg = `Plan 7 days of meals for a household of ${household_size}.
Diet style: ${diet_style || "balanced"}.
Dietary prefs: ${Array.isArray(dietary_prefs) && dietary_prefs.length ? dietary_prefs.join(", ") : "none"}.
${budget_usd ? `Weekly grocery budget: $${budget_usd}.` : "Keep it budget-friendly."}
${cuisine_focus ? `Lean toward: ${cuisine_focus}.` : "Mix common cuisines."}${profileBlock}
Reuse ingredients across meals to reduce waste. Use realistic 2026 US grocery prices (~8-12% above 2023 baseline).`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a practical, money-conscious meal planner. Always call return_meal_plan. Honor the requested diet style strictly (keto = <30g carbs/day, vegetarian = no meat or fish, vegan = no animal products, high-protein = ≥30g protein per main meal, mediterranean = olive oil + fish + legumes). Strictly honor dietary restrictions: halal = no pork or alcohol and meat must be halal-sourced; kosher = no pork/shellfish and never mix meat with dairy in the same meal; vegetarian = no meat or fish. Keep meals simple and realistic." },
          { role: "user", content: userMsg },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_meal_plan" } },
      }),
    });
    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit hit — try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return new Response(JSON.stringify({ error: "No structured response" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify(JSON.parse(args)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("meal-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
