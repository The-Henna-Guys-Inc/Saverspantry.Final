// Nutrition equivalency engine — swap a food for cheaper, nutritionally-equivalent alternatives
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
              notes: { type: "string", description: "1 short sentence: why this swap works nutritionally." },
            },
            required: ["title", "items", "protein_g", "calories_kcal", "estimated_cost_usd", "savings_percent", "notes"],
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
  try {
    const { food, dietary_prefs = [] } = await req.json();
    if (!food) return new Response(JSON.stringify({ error: "Missing 'food'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const prefs = Array.isArray(dietary_prefs) ? dietary_prefs.join(", ") : "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a nutrition equivalency engine. Given a food + portion, return 3 alternative combinations that match the protein and calories within ~15% but typically cost less. Use realistic US grocery prices. Strictly honor any dietary restrictions: halal = no pork or alcohol and meat must be halal-sourced; kosher = no pork/shellfish and never combine meat with dairy in one swap; vegetarian = no meat or fish. Be practical, never moralizing. Always call return_swaps." },
          { role: "user", content: `Find swaps for: ${food}\nDietary restrictions: ${prefs || "none"}` },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_swaps" } },
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
    console.error("equivalency error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
