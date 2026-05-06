// Lovable AI nutrition lookup — structured tool-call output
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NUTRITION_TOOL = {
  type: "function",
  function: {
    name: "return_nutrition",
    description: "Return nutrition facts for the queried food/portion.",
    parameters: {
      type: "object",
      properties: {
        food: { type: "string", description: "Normalized food name + portion, e.g. '2 tbsp chia seeds (24g)'" },
        serving_grams: { type: "number" },
        calories_kcal: { type: "number" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fiber_g: { type: "number" },
        fat_g: { type: "number" },
        key_micros: {
          type: "array",
          description: "2-4 most notable micronutrients with amount and unit.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              amount: { type: "number" },
              unit: { type: "string" },
              dv_percent: { type: "number", description: "Approx % Daily Value" },
            },
            required: ["name", "amount", "unit"],
            additionalProperties: false,
          },
        },
        notes: { type: "string", description: "1 short sentence with a money-saving or swap tip." },
      },
      required: ["food", "serving_grams", "calories_kcal", "protein_g", "carbs_g", "fiber_g", "fat_g", "key_micros", "notes"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'query' string" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a precise nutrition database. Given a natural-language food query (e.g. '2 tbsp chia seeds', '1 cup cooked quinoa'), return accurate macros and 2-4 standout micronutrients. Use commonly accepted USDA-style values. Always call the return_nutrition tool. Be friendly and money-conscious in the notes — never moralize about food choices.",
          },
          { role: "user", content: query },
        ],
        tools: [NUTRITION_TOOL],
        tool_choice: { type: "function", function: { name: "return_nutrition" } },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("AI gateway error:", resp.status, text);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit hit — please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No structured response" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const nutrition = JSON.parse(call.function.arguments);

    return new Response(JSON.stringify({ nutrition }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("nutrition-lookup error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
