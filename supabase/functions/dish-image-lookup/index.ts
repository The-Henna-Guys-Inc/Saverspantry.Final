// Resolve a credible image URL for a dish name.
// Strategy: ask Gemini (Lovable AI Gateway) via tool calling for the best
// English Wikipedia page title, then fetch that page's lead image from
// Wikipedia's REST API. Wikipedia images are CC-licensed and "credible".
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const fetchWikiThumb = async (title: string): Promise<string | null> => {
  try {
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      { headers: { Accept: "application/json" } },
    );
    if (!r.ok) return null;
    const j = await r.json();
    return (j?.originalimage?.source as string) || (j?.thumbnail?.source as string) || null;
  } catch { return null; }
};

const fetchWikiSearchThumb = async (q: string): Promise<string | null> => {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(q + " food dish")}&prop=pageimages&piprop=thumbnail&pithumbsize=600`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const pages = j?.query?.pages;
    if (!pages) return null;
    const first: any = Object.values(pages)[0];
    return (first?.thumbnail?.source as string) || null;
  } catch { return null; }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { dish, cuisine } = await req.json();
    if (!dish || typeof dish !== "string") {
      return new Response(JSON.stringify({ error: "dish required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    // Ask Gemini to map the dish to a canonical Wikipedia page title.
    const aiResp = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You map dish names to the best English Wikipedia page about that exact dish. Return only the page title (no URL). If multiple match, pick the most canonical food article. If no Wikipedia page exists, return an empty string." },
          { role: "user", content: `Dish: ${dish}${cuisine ? ` (cuisine: ${cuisine})` : ""}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "set_wiki_title",
            description: "Set the Wikipedia page title for the dish",
            parameters: {
              type: "object",
              properties: { title: { type: "string", description: "English Wikipedia page title or empty string" } },
              required: ["title"], additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "set_wiki_title" } },
      }),
    });
    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiResp.ok) throw new Error(`AI ${aiResp.status}`);
    const aiJson = await aiResp.json();
    const args = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let title = "";
    try { title = (JSON.parse(args ?? "{}")?.title ?? "").toString().trim(); } catch { /* ignore */ }

    let url: string | null = null;
    let source: string = "none";
    if (title) {
      url = await fetchWikiThumb(title);
      if (url) source = `wikipedia:${title}`;
    }
    if (!url) {
      url = await fetchWikiSearchThumb(dish);
      if (url) source = "wikipedia:search";
    }

    return new Response(JSON.stringify({ url, source, title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("dish-image-lookup error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
