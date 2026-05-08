// Reads an expiry date from a photo using Lovable AI Gateway (Gemini vision).
// Returns ISO date (YYYY-MM-DD) or null.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(JSON.stringify({ error: "Missing imageBase64" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const todayIso = new Date().toISOString().slice(0, 10);
    const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You read expiration / best-by / use-by dates from photos of food packaging. Today is ${todayIso}. Return the single most likely expiry date. Common formats: "EXP 12/25/2026", "BB 25 DEC 2026", "USE BY 2026-12-25", "12 26" (month/year). For month/year only, use the LAST day of that month. If multiple dates appear, prefer the one labeled EXP/BB/USE BY/BEST BY. If no clear date, return null.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "What is the expiration date in this photo?" },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_expiry",
              description: "Report the expiry date found",
              parameters: {
                type: "object",
                properties: {
                  date_iso: { type: ["string", "null"], description: "Expiry date in YYYY-MM-DD format, or null if not readable" },
                  raw_text: { type: "string", description: "The raw text as printed on the package" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["date_iso", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_expiry" } },
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
      date_iso: args.date_iso ?? null,
      raw_text: args.raw_text ?? null,
      confidence: args.confidence ?? "low",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("expiry-date-ocr error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
