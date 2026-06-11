// Import a recipe from a URL.
// Strategy: 1) try schema.org/Recipe JSON-LD (fast, deterministic, free).
//           2) fall back to AI extraction from cleaned HTML body text.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { requireUserId, unauthorized } from "../_shared/userAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Block private/loopback/link-local IP ranges to prevent SSRF.
function isPrivateIp(ip: string): boolean {
  // IPv4
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local incl. AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  // IPv6: block loopback, link-local, unique-local, mapped-private
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) {
    return isPrivateIp(lower.slice(7));
  }
  return false;
}

async function isHostnameSafe(hostname: string): Promise<boolean> {
  // Reject IP literals to private ranges directly
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) {
    return !isPrivateIp(hostname);
  }
  // Reject obvious internal names
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local") || lower.endsWith(".internal")) {
    return false;
  }
  try {
    const records = await Promise.all([
      Deno.resolveDns(hostname, "A").catch(() => [] as string[]),
      Deno.resolveDns(hostname, "AAAA").catch(() => [] as string[]),
    ]);
    const ips = records.flat();
    if (ips.length === 0) return false;
    return ips.every((ip) => !isPrivateIp(ip));
  } catch {
    return false;
  }
}


const TOOL = {
  type: "function",
  function: {
    name: "return_recipe",
    description: "Return a structured recipe extracted from a webpage.",
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
            properties: { item: { type: "string" }, quantity: { type: "string" } },
            required: ["item", "quantity"],
            additionalProperties: false,
          },
        },
        steps: { type: "array", items: { type: "string" }, minItems: 2 },
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
        tip: { type: "string" },
      },
      required: ["title", "cuisine", "servings", "time_minutes", "ingredients", "steps", "nutrition_per_serving", "estimated_total_cost_usd", "tip"],
      additionalProperties: false,
    },
  },
};

function parseISODurationMinutes(s?: string): number | undefined {
  if (!s) return;
  const m = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return;
  return (Number(m[1] || 0) * 60) + Number(m[2] || 0);
}

function findRecipeNode(node: any): any | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipeNode(n);
      if (r) return r;
    }
    return null;
  }
  const t = node["@type"];
  const types = Array.isArray(t) ? t : [t];
  if (types.includes("Recipe")) return node;
  if (node["@graph"]) return findRecipeNode(node["@graph"]);
  return null;
}

function tryJsonLd(html: string) {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of matches) {
    try {
      const json = JSON.parse(m[1].trim());
      const recipe = findRecipeNode(json);
      if (recipe) return recipe;
    } catch { /* skip */ }
  }
  return null;
}

function normalizeRecipe(r: any) {
  const ingArr = Array.isArray(r.recipeIngredient) ? r.recipeIngredient : [];
  const ingredients = ingArr.map((s: string) => {
    const text = String(s).trim();
    const m = text.match(/^([\d¼½¾⅓⅔⅛\/.\s]+(?:cups?|tbsp|tsp|g|kg|oz|lb|ml|l|cloves?|pieces?)?)\s+(.+)$/i);
    return m ? { quantity: m[1].trim(), item: m[2].trim() } : { quantity: "", item: text };
  });
  const stepsRaw = r.recipeInstructions;
  let steps: string[] = [];
  if (Array.isArray(stepsRaw)) {
    steps = stepsRaw.flatMap((s: any) => {
      if (typeof s === "string") return [s];
      if (s?.text) return [s.text];
      if (s?.itemListElement) return s.itemListElement.map((x: any) => x?.text ?? "").filter(Boolean);
      return [];
    });
  } else if (typeof stepsRaw === "string") {
    steps = stepsRaw.split(/\n+|\.\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
  }
  const n = r.nutrition || {};
  const num = (v: any) => {
    if (v == null) return 0;
    const m = String(v).match(/[\d.]+/);
    return m ? Number(m[0]) : 0;
  };
  const yieldNum = (() => {
    const y = r.recipeYield;
    if (typeof y === "number") return y;
    if (Array.isArray(y)) return Number(String(y[0]).match(/\d+/)?.[0]) || 4;
    const m = String(y || "").match(/\d+/);
    return m ? Number(m[0]) : 4;
  })();
  return {
    title: r.name ?? "Imported recipe",
    cuisine: Array.isArray(r.recipeCuisine) ? r.recipeCuisine[0] : (r.recipeCuisine ?? "imported"),
    servings: yieldNum,
    time_minutes: parseISODurationMinutes(r.totalTime) ?? parseISODurationMinutes(r.cookTime) ?? 30,
    ingredients,
    steps: steps.length ? steps : ["See original recipe link for full instructions."],
    nutrition_per_serving: {
      calories_kcal: num(n.calories),
      protein_g: num(n.proteinContent),
      carbs_g: num(n.carbohydrateContent),
      fat_g: num(n.fatContent),
    },
    estimated_total_cost_usd: 0,
    tip: "Imported from web — costs not estimated.",
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const userId = await requireUserId(req);
  if (!userId) return unauthorized(corsHeaders);
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing url" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let parsed: URL;
    try { parsed = new URL(url); } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ error: "Only http/https URLs allowed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!(await isHostnameSafe(parsed.hostname))) {
      return new Response(JSON.stringify({ error: "URL host is not allowed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const html = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 SaversPantryBot/1.0" },
      redirect: "error",
      signal: controller.signal,
    }).then((r) => r.ok ? r.text() : Promise.reject(new Error(`Fetch ${r.status}`)))
      .finally(() => clearTimeout(timeout));

    // 1) JSON-LD path
    const ld = tryJsonLd(html);
    if (ld) {
      const recipe = normalizeRecipe(ld);
      const stepsCount = recipe.steps?.length ?? 0;
      // C-2: do NOT return verbatim instructions — they're copyrightable.
      // We keep ingredients (factual list) and link back to the source for steps.
      return new Response(JSON.stringify({ ...recipe, steps: [], steps_count: stepsCount, source: "json-ld", source_url: url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) AI fallback
    const text = htmlToText(html);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "No structured recipe found on page and AI not configured." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Extract a clean, structured recipe from this webpage text. If multiple recipes appear, pick the main one. Always call return_recipe. Estimate cost from typical US grocery prices if unclear." },
          { role: "user", content: `URL: ${url}\n\nPage text:\n${text}` },
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
    if (!args) return new Response(JSON.stringify({ error: "Could not extract a recipe from this page." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ ...JSON.parse(args), source: "ai", source_url: url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("recipe-import-url error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
