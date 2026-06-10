// Resolve the "real" current-week flyer URL for a flyer_source, and produce
// the Firecrawl `actions` needed to (a) get past the store/ZIP picker and
// (b) click the current-week tab when the source uses week-selector tabs.
//
// Layer A — URL resolution: Firecrawl `map` with a search hint, then
// `search` as a fallback. Cached for RESOLVE_TTL_DAYS.
// Layer B — Store/ZIP picker (NEW): if the source has a `store_zip` (or
// store ID) and `store_picker_strategy` != 'none', learn the input + submit
// CSS selectors once via Gemini and emit type/click/wait actions.
// Layer C — Week-selector tabs: learn the tab selector via Gemini and emit
// click/select + wait actions.
//
// Auth: x-cron-secret OR admin JWT OR internal service-role bearer.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { logAiUsage } from "../_shared/aiUsage.ts";

const BodySchema = z.object({
  source_id: z.string().uuid(),
  force: z.boolean().optional(),
  relearn_selector: z.boolean().optional(),
  relearn_picker: z.boolean().optional(),
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
  const { source_id, force, relearn_selector, relearn_picker } = parsed.data;

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

  const actions: any[] = [];
  const pickerStrategy: string = src.store_picker_strategy ?? "none";
  const wantsPicker = pickerStrategy !== "none" && !!src.store_zip;
  let pickerInput = src.store_picker_input_css ?? null;
  let pickerSubmit = src.store_picker_submit_css ?? null;
  let force_firecrawl = src.render_mode === "firecrawl" || !!src.requires_week_select || wantsPicker;

  // ---- Layer B: store/ZIP picker ----
  if (wantsPicker) {
    if ((!pickerInput || relearn_picker) && fcKey && apiKey) {
      const learned = await learnStorePicker(fcKey, apiKey, resolvedUrl || landing, pickerStrategy, actingUserId);
      if (learned.input) {
        pickerInput = learned.input;
        pickerSubmit = learned.submit;
        await admin.from("flyer_sources").update({
          store_picker_input_css: learned.input,
          store_picker_submit_css: learned.submit,
          store_picker_learned_at: new Date().toISOString(),
        }).eq("id", src.id);
      }
    }
    if (pickerInput) {
      actions.push({ type: "wait", milliseconds: 1500 });
      actions.push({ type: "write", selector: pickerInput, text: String(src.store_zip) });
      actions.push({ type: "wait", milliseconds: 800 });
      if (pickerSubmit) actions.push({ type: "click", selector: pickerSubmit });
      else actions.push({ type: "press", key: "Enter" });
      actions.push({ type: "wait", milliseconds: 3000 });
    }
  }

  // ---- Layer C: week-selector tabs ----
  let learnedSelector: string | null = src.week_selector_css ?? null;
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
      actions.push({ type: "wait", milliseconds: 1500 });
      actions.push(
        src.week_selector_strategy === "select"
          ? { type: "selectOption", selector: learnedSelector, value: "current" }
          : { type: "click", selector: learnedSelector },
      );
      actions.push({ type: "wait", milliseconds: 2000 });
    }
  }

  return json({
    ok: true,
    resolved_url: resolvedUrl,
    resolved_via: resolvedVia,
    force_firecrawl,
    actions: actions.length ? actions : null,
    selector: learnedSelector,
    picker: pickerInput ? { input: pickerInput, submit: pickerSubmit, strategy: pickerStrategy } : null,
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
    if (/\d{4}/.test(low)) s += 1;
    if (low.length < 90) s += 1;
    return { u, s };
  }).sort((a, b) => b.s - a.s);
  return scored[0].s > 0 ? scored[0].u : urls[0];
}

async function scrapeHtml(fcKey: string, url: string): Promise<string> {
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${fcKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["html"], onlyMainContent: false, waitFor: 2500 }),
    });
    const j = await r.json().catch(() => ({}));
    return j?.data?.html ?? j?.html ?? "";
  } catch { return ""; }
}

function trimHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .slice(0, 30000);
}

// ---------- Selector learning: week tabs ----------

async function learnWeekSelector(
  fcKey: string, apiKey: string, url: string, userId: string | null,
): Promise<{ selector: string | null; strategy: "click" | "select" | null }> {
  const html = await scrapeHtml(fcKey, url);
  if (!html) return { selector: null, strategy: null };
  const trimmed = trimHtml(html);

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

// ---------- Selector learning: store/ZIP picker ----------

async function learnStorePicker(
  fcKey: string, apiKey: string, url: string, strategy: string, userId: string | null,
): Promise<{ input: string | null; submit: string | null }> {
  const html = await scrapeHtml(fcKey, url);
  if (!html) return { input: null, submit: null };
  const trimmed = trimHtml(html);

  const tool = {
    type: "function",
    function: {
      name: "report_picker",
      description: "Return CSS selectors for a grocery store's ZIP / store-locator picker.",
      parameters: {
        type: "object",
        properties: {
          input_selector:  { type: ["string", "null"], description: "CSS selector for the ZIP/store input field" },
          submit_selector: { type: ["string", "null"], description: "CSS selector for the submit/search/find-store button (null if Enter works)" },
          reason:          { type: ["string", "null"] },
        },
        required: ["input_selector"],
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
            "You read raw HTML of a grocery store's weekly-ad page that gates content behind a store/ZIP picker. " +
            `The user wants to enter a ${strategy === "storeid" ? "store ID" : "ZIP code"}. ` +
            "Find the input field where the value goes, and the submit/search/'find store'/'set my store' button. " +
            "Prefer stable selectors: id, name, data-* attributes, aria-label. Avoid generated class hashes. " +
            "If no picker is visible, return input_selector=null."
          },
          { role: "user", content: `URL: ${url}\n\nHTML:\n${trimmed}` },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "report_picker" } },
      }),
    });
  } catch { return { input: null, submit: null }; }
  const latency = Date.now() - t0;

  if (!aiResp.ok) {
    if (userId) await logAiUsage({ userId, functionName: FN, model: MODEL, latencyMs: latency, status: "error", error: `${aiResp.status}` });
    return { input: null, submit: null };
  }
  const aiJson = await aiResp.json();
  if (userId) {
    const u = aiJson.usage ?? {};
    await logAiUsage({ userId, functionName: FN, model: MODEL, latencyMs: latency, promptTokens: u.prompt_tokens ?? 0, completionTokens: u.completion_tokens ?? 0 });
  }
  try {
    const args = JSON.parse(aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}");
    if (!args.input_selector) return { input: null, submit: null };
    return {
      input: String(args.input_selector).slice(0, 240),
      submit: args.submit_selector ? String(args.submit_selector).slice(0, 240) : null,
    };
  } catch { return { input: null, submit: null }; }
}

async function safeJson(req: Request) { try { return await req.json(); } catch { return {}; } }

// ---------- B: stability filter for learned selectors ----------
// Reject CSS-in-JS hashed class names like ".e-12otqdk", ".css-1a2b3c", ".jsx-1234567890",
// ".sc-abc123", ".MuiButton-root-12345". They change on every build/render.
function isStableSelector(sel: string | null | undefined): boolean {
  if (!sel || typeof sel !== "string") return false;
  const s = sel.trim();
  if (!s) return false;
  // Strong stable anchors → accept immediately
  if (/(?:^|[\s>+~])(?:#[\w-]+|\[(?:id|name|data-[\w-]+|aria-[\w-]+|placeholder|type|role)[~|^$*]?=)/i.test(s)) return true;
  if (/\b(?:input|button|form|select|textarea)\b/i.test(s) && /\[/.test(s)) return true;
  // Otherwise look at class tokens
  const classes = s.match(/\.[A-Za-z_][\w-]*/g) ?? [];
  if (!classes.length) {
    // Bare tag selector (e.g., "input[type=text]") — acceptable if it has attribute
    return /\[/.test(s);
  }
  const hashy = (c: string) =>
    /^\.css-[\w-]{4,}$/.test(c) ||
    /^\.sc-[\w-]{4,}$/.test(c) ||
    /^\.jsx-\d{4,}$/.test(c) ||
    /^\.[a-z]{1,3}-?[a-z0-9]{6,}$/i.test(c) && /\d/.test(c) || // .e12otqdk, .a1b2c3d4
    /^\.[A-Za-z]+-[a-z0-9]{6,}$/i.test(c) && /\d/.test(c);    // .MuiButton-root12345 style hashes
  const stableCount = classes.filter((c) => !hashy(c)).length;
  return stableCount > 0;
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
