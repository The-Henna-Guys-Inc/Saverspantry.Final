// AI Grocery list builder: consolidate ingredients across a meal plan into a shopping list
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ITEM = {
  type: "object",
  properties: {
    item: { type: "string" },
    quantity: { type: "string" },
    category: { type: "string", description: "produce, protein, dairy, pantry, frozen, bakery, other" },
    estimated_cost_usd: { type: "number" },
  },
  required: ["item", "quantity", "category", "estimated_cost_usd"],
  additionalProperties: false,
};

const TOOL = {
  type: "function",
  function: {
    name: "return_grocery_list",
    description: "Return a consolidated grocery list grouped by category.",
    parameters: {
      type: "object",
      properties: {
        items: { type: "array", items: ITEM },
        total_estimated_cost_usd: { type: "number" },
      },
      required: ["items", "total_estimated_cost_usd"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { plan, household_size = 2 } = await req.json();
    if (!plan) return new Response(JSON.stringify({ error: "Missing plan" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You build consolidated grocery lists from meal plans. Combine duplicate ingredients, scale to household size, group by store category. Skip salt/pepper/oil/common spices. Realistic US prices. Always call return_grocery_list." },
          { role: "user", content: `Household: ${household_size}.\nMeal plan JSON:\n${JSON.stringify(plan)}` },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_grocery_list" } },
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
    console.error("grocery-list error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
