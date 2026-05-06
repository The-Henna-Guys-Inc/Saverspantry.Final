// AI Recipe generator from ingredients + cuisine
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
          },
          required: ["calories_kcal", "protein_g", "carbs_g", "fat_g"],
          additionalProperties: false,
        },
        estimated_total_cost_usd: { type: "number" },
        tip: { type: "string", description: "1 short money-saving or technique tip." },
      },
      required: ["title", "cuisine", "servings", "time_minutes", "ingredients", "steps", "nutrition_per_serving", "estimated_total_cost_usd", "tip"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { ingredients, cuisine } = await req.json();
    if (!ingredients || !cuisine) return new Response(JSON.stringify({ error: "Missing ingredients or cuisine" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a friendly home cook. Generate one practical recipe for the given cuisine using mostly the available ingredients (assume basic pantry: salt, pepper, oil, common spices). Realistic US grocery prices. Always call return_recipe." },
          { role: "user", content: `Cuisine: ${cuisine}\nAvailable ingredients: ${ingredients}` },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_recipe" } },
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
    console.error("recipe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
