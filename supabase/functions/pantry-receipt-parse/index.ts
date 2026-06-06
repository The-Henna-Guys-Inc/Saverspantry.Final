// Parses a receipt photo, removal list, or item photo into a structured list of pantry items.
// Supports mode: "add" | "remove" | "auto" (auto-detects image type).
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
    const m = mode === "remove" ? "remove" : mode === "add" ? "add" : "auto";
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

    const systemAuto =
      "You analyze a photo and extract grocery/pantry items from it. The image could be one of: " +
      "(1) a printed store RECEIPT, (2) a handwritten or typed LIST of items, or (3) a PHOTO of actual food/grocery items (fridge, counter, bag of groceries, etc). " +
      "First detect which type it is. Then extract every distinct food/grocery item visible. " +
      "For receipts: skip totals, taxes, fees, discounts, loyalty/payment lines; normalize cryptic abbreviations (e.g. 'GV WHL MLK GAL' -> 'Whole Milk'); use printed weights/counts. " +
      "For lists: parse informal quantities ('half' -> 0.5, 'quarter' -> 0.25, 'a'/'one' -> 1). " +
      "For item photos: identify each visible product (e.g. 'Bananas', 'Eggs', 'Whole Milk'); count when possible, otherwise quantity 1 unit 'unit'. " +
      "Pick category from: produce, protein, dairy, pantry, frozen, bakery, other. Default qty 1, unit 'unit' if unclear. " +
      "Also suggest the most likely action: 'add' (receipts and item photos usually mean adding to pantry) or 'remove' (handwritten removal/used-up lists usually mean removing).";

    const systemContent = m === "add" ? systemAdd : m === "remove" ? systemRemove : systemAuto;
    const userText =
      m === "add" ? "Extract the grocery items from this receipt." :
      m === "remove" ? "Extract the items being removed from pantry." :
      "Detect what this image is (receipt, list, or item photo) and extract every item with quantity and category.";

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemContent },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
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
                  detected_type: { type: "string", enum: ["receipt", "list", "items", "unknown"], description: "What kind of image this is" },
                  suggested_action: { type: "string", enum: ["add", "remove"], description: "Most likely action for the detected content" },
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
    const detected_type = args.detected_type ?? (m === "remove" ? "list" : m === "add" ? "receipt" : "unknown");
    const suggested_action = args.suggested_action ?? (detected_type === "list" ? "remove" : "add");
    return new Response(JSON.stringify({
      detected_type,
      suggested_action,
      store_name: args.store_name ?? null,
      items: Array.isArray(args.items) ? args.items : [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("pantry-receipt-parse error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
