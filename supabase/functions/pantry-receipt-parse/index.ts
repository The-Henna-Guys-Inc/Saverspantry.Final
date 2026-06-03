// Parses a receipt photo or a handwritten "removal" note into a structured list of pantry items.
// Uses Lovable AI Gateway (Gemini vision) with tool calling for reliable structured output.
import { requireUserId, unauthorized } from "../_shared/userAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const userId = await requireUserId(req);
  if (!userId) return unauthorized(corsHeaders);
  try {
    const { imageBase64, mode } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(JSON.stringify({ error: "Missing imageBase64" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const m = mode === "remove" ? "remove" : "add";
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    const systemAdd =
      "You read grocery store receipts. Extract every food/grocery line item the customer bought. " +
      "Skip totals, taxes, fees, discounts, store loyalty lines, payment lines, dates, store info. " +
      "Normalize cryptic abbreviations into a clean human name (e.g. 'GV WHL MLK GAL' -> 'Whole Milk'). " +
      "Pick a sensible quantity and unit from the receipt — if the line shows weight (e.g. '1.32 LB BANANAS'), use that; " +
      "if it's a count (e.g. '2 @ $3.99'), use count with unit 'unit'. Default to quantity 1, unit 'unit' if unclear. " +
      "Pick a category from: produce, protein, dairy, pantry, frozen, bakery, other.";

    const systemRemove =
      "You read a handwritten or typed list of grocery items the user is removing/using from their pantry. " +
      "Extract each item with its quantity and unit. The list may be informal: '2 eggs', 'half cup rice', 'milk - 1 cup'. " +
      "Convert fractions like 'half' -> 0.5, 'quarter' -> 0.25, 'a' or 'one' -> 1. Default to quantity 1, unit 'unit' if unclear. " +
      "Pick a category from: produce, protein, dairy, pantry, frozen, bakery, other.";

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: m === "add" ? systemAdd : systemRemove },
          {
            role: "user",
            content: [
              { type: "text", text: m === "add" ? "Extract the grocery items from this receipt." : "Extract the items being removed from pantry." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_items",
              description: "Report the parsed list of pantry items",
              parameters: {
                type: "object",
                properties: {
                  store_name: { type: ["string", "null"], description: "Store name if visible on receipt" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Clean human-readable item name" },
                        quantity: { type: "number" },
                        unit: { type: "string", enum: ["unit", "g", "kg", "oz", "lb", "ml", "L", "cup", "tbsp", "tsp"] },
                        category: { type: "string", enum: ["produce", "protein", "dairy", "pantry", "frozen", "bakery", "other"] },
                        raw_text: { type: "string", description: "The raw line as printed/written" },
                      },
                      required: ["name", "quantity", "unit", "category"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_items" } },
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit — try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI gateway error ${resp.status}: ${t}`);
    }
    const j = await resp.json();
    const call = j?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : {};
    return new Response(JSON.stringify({
      store_name: args.store_name ?? null,
      items: Array.isArray(args.items) ? args.items : [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("pantry-receipt-parse error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
