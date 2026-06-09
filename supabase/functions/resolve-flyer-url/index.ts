// Resolve the "real" current-week flyer URL for a flyer_source.
// Layer A: use Firecrawl `map` (with search) on the landing domain to find
//   the freshest weekly-ad page, falling back to Firecrawl `search`.
// Layer B: if the source has `requires_week_select`, learn (or reuse) the
//   CSS selector for the "this week" tab via one Gemini call, and return
//   Firecrawl `actions` the caller should attach to the scrape call.
//
// Auth: x-cron-secret OR admin JWT. Service-role calls (from discover-
// flyer-sources) just pass the service key as Bearer + the cron secret.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { logAiUsage } from "../_shared/aiUsage.ts";

const BodySchema = z.object({
  source_id: z.string().uuid(),
  force: z.boolean().optional(),          // ignore 14-day cache
  relearn_selector: z.boolean().optional(),
});

const RESOLVE_TTL_DAYS = 14;
const FN = "resolve-flyer-url";
const MODEL = "google/gemini-2.5-flash";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Auth: cron secret, service-role bearer (internal call from discover-flyer-sources), or admin JWT.
  const cronSecret = req.headers.get("x-cron-secret");
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let actingUserId: string | null = null;
  if (cronSecret) {
    const { data: ok } = await admin.rpc("verify_cron_secret", { _secret: cronSecret });
    if (!ok) return json({ error: "bad cron secret" }, 401);
    const { data: firstAdmin } = await admin.from("user_roles").select("user_id")
      .eq("role", "admin").limit(1).maybeSingle();
    actingUserId = firstAdmin?.user_id ?? null;
  } else if (token === serviceKey) {
    const { data: firstAdmin } = await admin.from("user_roles").select("user_id")
      .eq("role", "admin").limit(1).maybeSingle();
    actingUserId = firstAdmin?.user_id ?? null;
  } else {
    if (!token) return json({ error: "missing auth" }, 401);
    const userClient = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json({ error: "invalid auth" }, 401);
    const { data: roleRow } = await admin.from("user_roles").select("role")
      .eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "admin only" }, 403);
    actingUserId = userRes.user.id;
  }

  const parsed = BodySchema.safeParse(await safeJson(req));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const { source_id, force, relearn_selector } = parsed.data;

  const { data: src, error: sErr } = await admin.from("flyer_sources")
    .select("*").eq("id", source_id).maybeSingle();
  if (sErr || !src) return json({ error: "source not found" }, 404);

  const landing = src.flyer_landing_url || src.flyer_url;
  if (!landing) return json({ error: "source has no landing or flyer URL" }, 400);

  // ---- Layer A: resolve URL ----
  const cacheFresh = src.last_resolved_url && src.last_resolved_at &&
    (Date.now() - new Date(src.last_resolved_at).getTime() < RESOLVE_TTL_DAYS * 86400_000) &&
    src.last_status === "ok";

  let resolvedUrl = src.last_resolved_url ?? null;
  let resolvedVia: "cache" | "map" | "search" | "landing" = "cache";

  if (!cacheFresh || force) {
    if (!fcKey) {
      // No Firecrawl — just use landing URL.
      resolvedUrl = landing;
      resolvedVia = "landing";
    } else {
      const mapHit = await firecrawlMap(fcKey, landing, [
        "weekly ad", "weekly-ad", "circular", "flyer", src.city ?? "",
      ].filter(Boolean).join(" "));
      if (mapHit) { resolvedUrl = mapHit; resolvedVia = "map"; }
      else {
        const searchHit = await firecrawlSearch(fcKey,
          `${src.chain_name} weekly ad ${src.city ?? ""} ${new Date().toISOString().slice(0, 10)}`.trim());
        if (searchHit) { resolvedUrl = searchHit; resolvedVia = "search"; }
        else { resolvedUrl = landing; resolvedVia = "landing"; }
      }
    }
    await admin.from("flyer_sources").update({
      last_resolved_url: resolvedUrl, last_resolved_at: new Date().toISOString(),
    }).eq("id", src.id);
  }

  // ---- Layer B: selector learning + Firecrawl actions ----
  let actions: any[] | null = null;
  let learnedSelector: string | null = src.week_selector_css ?? null;
  let force_firecrawl = src.render_mode === "firecrawl" || !!src.requires_week_select;

  if (src.requires_week_select) {
    if ((!learnedSelector || relearn_selector) && fcKey && apiKey) {
      const learned = await learnWeekSelector(fcKey, apiKey, resolvedUrl!, actingUserId);
      if (learned.selector) {
        learnedSelector = learned.selector;
        await admin.from("flyer_sources").update({
          week_selector_css: learned.selector,
          week_selector_strategy: learned.strategy ?? "click",
          selector_learned_at: new Date().toISOString(),
        }).eq("id", src.id);
      }
    }
    if (learnedSelector) {
      actions = [
        { type: "wait", milliseconds: 1500 },
        src.week_selector_strategy === "select"
          ? { type: "selectOption", selector: learnedSelector, value: "current" }
          : { type: "click", selector: learnedSelector },
        { type: "wait", milliseconds: 2000 },
      ];
    }
  }

  return json({
    ok: true,
    resolved_url: resolvedUrl,
    resolved_via: resolvedVia,
    force_firecrawl,
    actions,
    selector: learnedSelector,
  });
});

// ---------- Firecrawl helpers ----------

async function firecrawlMap(key: string, url: string, search: string): Promise<string | null> {
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/map", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, search, limit: 30, includeSubdomains: false }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return null;
    const links: string[] = j?.links ?? j?.data?.links ?? [];
    return pickBestFlyerLink(links);
  } catch { return null; }
}

async function firecrawlSearch(key: string, query: string): Promise<string | null> {
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 8 }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return null;
    const items = j?.data ?? j?.web?.results ?? [];
    const urls: string[] = items.map((x: any) => x?.url).filter(Boolean);
    return pickBestFlyerLink(urls);
  } catch { return null; }
}

function pickBestFlyerLink(urls: string[]): string | null {
  if (!urls?.length) return null;
  const keywords = ["weeklyad", "weekly-ad", "weekly_ad", "circular", "flyer", "savings"];
  const scored = urls.map((u) => {
    const low = u.toLowerCase();
    let s = 0;
    for (const k of keywords) if (low.includes(k)) s += 2;
    if (/\d{4}/.test(low)) s += 1;     // date in URL → fresher
    if (low.length < 90) s += 1;
    return { u, s };
  }).sort((a, b) => b.s - a.s);
  return scored[0].s > 0 ? scored[0].u : urls[0];
}

// ---------- Selector learning ----------

async function learnWeekSelector(
  fcKey: string, apiKey: string, url: string, userId: string | null,
): Promise<{ selector: string | null; strategy: "click" | "select" | null }> {
  let html = "";
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${fcKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["html"], onlyMainContent: false, waitFor: 2500 }),
    });
    const j = await r.json().catch(() => ({}));
    html = j?.data?.html ?? j?.html ?? "";
  } catch { return { selector: null, strategy: null }; }

  if (!html) return { selector: null, strategy: null };
  // Trim aggressively — we only need controls.
  const trimmed = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .slice(0, 30000);

  const tool = {
    type: "function",
    function: {
      name: "report_selector",
      description: "Return a CSS selector that opens the CURRENT week's flyer.",
      parameters: {
        type: "object",
        properties: {
          strategy: { type: "string", enum: ["click", "select", "none"] },
          selector: { type: ["string", "null"] },
          reason:   { type: ["string", "null"] },
        },
        required: ["strategy"],
        additionalProperties: false,
      },
    },
  };

  const t0 = Date.now();
  let aiResp: Response;
  try {
    aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content:
            "You read raw HTML of a grocery store's weekly-ad page. Many sites show multiple week tabs (previous/current/next). " +
            "Return ONE unique CSS selector that, when clicked or selected, will load the CURRENT week's deals. " +
            "Prefer data-* attributes, aria-current, or text containing 'this week' / today's date range. " +
            "If a <select> dropdown controls the week, return strategy='select' with its selector. " +
            "If nothing applies, return strategy='none'."
          },
          { role: "user", content: `URL: ${url}\n\nHTML:\n${trimmed}` },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "report_selector" } },
      }),
    });
  } catch { return { selector: null, strategy: null }; }
  const latency = Date.now() - t0;

  if (!aiResp.ok) {
    if (userId) await logAiUsage({ userId, functionName: FN, model: MODEL, latencyMs: latency, status: "error", error: `${aiResp.status}` });
    return { selector: null, strategy: null };
  }
  const aiJson = await aiResp.json();
  if (userId) {
    const u = aiJson.usage ?? {};
    await logAiUsage({ userId, functionName: FN, model: MODEL, latencyMs: latency, promptTokens: u.prompt_tokens ?? 0, completionTokens: u.completion_tokens ?? 0 });
  }
  try {
    const args = JSON.parse(aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}");
    if (args.strategy === "none" || !args.selector) return { selector: null, strategy: null };
    return { selector: String(args.selector).slice(0, 240), strategy: args.strategy === "select" ? "select" : "click" };
  } catch { return { selector: null, strategy: null }; }
}

async function safeJson(req: Request) { try { return await req.json(); } catch { return {}; } }
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
