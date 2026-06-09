// Admin-only: import a flyer from a URL. Store + dates are optional —
// after extraction the admin confirms them in a dialog before deals
// hit the moderation queue. PDF/image links are handed off to the
// existing extract-flyer-deals pipeline. HTML pages are fetched as
// plain text and parsed with an LLM (no Firecrawl/JS rendering).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { logAiUsage } from "../_shared/aiUsage.ts";

const BodySchema = z.object({
  url: z.string().url(),
  store_id: z.string().uuid().optional().nullable(),
  valid_from: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  // Internal: set by the cron scraper running with service-role auth.
  internal_admin_user_id: z.string().uuid().optional().nullable(),
  // Optional: force Firecrawl (for JS-rendered/multi-week pages) and optional
  // pre-scrape actions (click "this week" tab, etc.) passed in by resolve-flyer-url.
  force_firecrawl: z.boolean().optional(),
  firecrawl_actions: z.array(z.any()).optional().nullable(),
});

const MAX_BYTES = 20 * 1024 * 1024;
const MODEL = "google/gemini-2.5-flash";
const FN = "import-flyer-from-url";

const tool = {
  type: "function",
  function: {
    name: "record_deals",
    description: "Record every distinct sale item in the page text, plus the store identity and validity window if printed.",
    parameters: {
      type: "object",
      properties: {
        store_hint: {
          type: ["object", "null"],
          properties: {
            name: { type: ["string", "null"] },
            chain_name: { type: ["string", "null"] },
            address: { type: ["string", "null"] },
            city: { type: ["string", "null"] },
            region: { type: ["string", "null"] },
            zip: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
        valid_from:  { type: ["string", "null"], description: "YYYY-MM-DD if printed." },
        valid_until: { type: ["string", "null"], description: "YYYY-MM-DD if printed." },
        deals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              food_name: { type: "string" },
              title: { type: "string" },
              sale_price_usd: { type: "number" },
              regular_price_usd: { type: ["number", "null"] },
              pack_size: { type: ["string", "null"] },
              category: {
                type: "string",
                enum: ["produce","meat","seafood","dairy","bakery","pantry","frozen","beverage","snack","household","other"],
              },
            },
            required: ["food_name","title","sale_price_usd","category"],
            additionalProperties: false,
          },
        },
      },
      required: ["deals"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const apiKey = Deno.env.get("LOVABLE_API_KEY");

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing auth" }, 401);

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Service-role internal call (cron scraper). Otherwise: user JWT + admin role check.
  let actingUserId: string;
  const parsed = BodySchema.safeParse(await safeJson(req));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

  if (token === serviceKey && parsed.data.internal_admin_user_id) {
    actingUserId = parsed.data.internal_admin_user_id;
  } else {
    const userClient = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "invalid auth" }, 401);
    const { data: roleRow } = await admin.from("user_roles").select("role")
      .eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "admin only" }, 403);
    actingUserId = userRes.user.id;
  }

  const { url, store_id, valid_from, valid_until } = parsed.data;

  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SaversPantryBot/1.0; +https://saverspantry.com)",
        "Accept": "application/pdf,image/*,text/html;q=0.9,*/*;q=0.8",
      },
    });
  } catch (e) {
    return json({ error: `Could not fetch URL: ${e instanceof Error ? e.message : String(e)}` }, 400);
  }
  if (!res.ok) return json({ error: `URL returned ${res.status}` }, 400);

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase().split(";")[0].trim();
  const isPdf = contentType === "application/pdf";
  const isImg = contentType.startsWith("image/");
  const isHtml = contentType.startsWith("text/html") || contentType.includes("xhtml");

  const flyerValidFrom = valid_from ? new Date(valid_from).toISOString() : null;
  const flyerValidUntil = valid_until ? new Date(valid_until).toISOString() : null;

  // ---- PDF / image: hand off to extract-flyer-deals (it does the AI vision call) ----
  if (isPdf || isImg) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return json({ error: "File >20MB" }, 400);
    const ext = isPdf ? "pdf" : (contentType.split("/")[1] || "bin");

    const { data: batch, error: bErr } = await admin
      .from("flyer_extraction_batches")
      .insert({
        store_id: store_id ?? null,
        admin_user_id: actingUserId,
        original_filename: url.split("/").pop()?.slice(0, 200) || "url-import",
        stored_file_url: "pending",
        file_type: contentType,
        flyer_valid_from: flyerValidFrom,
        flyer_valid_until: flyerValidUntil,
        extraction_status: "pending",
        source_url: url,
        requires_confirmation: true,
      } as any).select("id").single();
    if (bErr || !batch) return json({ error: bErr?.message ?? "batch insert failed" }, 500);

    const path = `${batch.id}/flyer.${ext}`;
    const { error: upErr } = await admin.storage.from("flyer-uploads")
      .upload(path, buf, { contentType, upsert: true });
    if (upErr) return json({ error: `upload: ${upErr.message}` }, 500);
    await admin.from("flyer_extraction_batches").update({ stored_file_url: path }).eq("id", batch.id);

    const extractRes = await fetch(`${supaUrl}/functions/v1/extract-flyer-deals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ batch_id: batch.id }),
    });
    const extracted = await extractRes.json().catch(() => ({}));
    return json({ ok: extractRes.ok, mode: isPdf ? "pdf" : "image", batch_id: batch.id, extracted });
  }

  // ---- HTML: fetch + LLM extract directly here ----
  if (!isHtml) return json({ error: `Unsupported content-type: ${contentType || "unknown"}` }, 400);
  if (!apiKey) return json({ error: "AI gateway not configured" }, 500);

  const html = await res.text();
  let text = stripHtml(html);
  let usedFirecrawl = false;

  // Fallback: JS-rendered flyer sites (Flipp, Circular.com, etc.) — try Firecrawl.
  if (text.length < 300) {
    const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!fcKey) {
      return json({
        error: "Page returned almost no text and Firecrawl is not configured. Try the direct PDF/image link if the site offers one.",
        text_length: text.length,
      }, 422);
    }
    try {
      const fcResp = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${fcKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 2500 }),
      });
      const fcJson = await fcResp.json().catch(() => ({}));
      if (!fcResp.ok) {
        if (fcResp.status === 402) return json({ error: "Firecrawl credits exhausted." }, 402);
        return json({ error: `Firecrawl failed (${fcResp.status})`, detail: String(fcJson?.error ?? "").slice(0, 240) }, 422);
      }
      const md = fcJson?.data?.markdown ?? fcJson?.markdown ?? "";
      if (md && md.length > text.length) { text = md; usedFirecrawl = true; }
    } catch (e) {
      return json({ error: `Firecrawl request failed: ${e instanceof Error ? e.message : String(e)}` }, 502);
    }
    if (text.length < 300) {
      return json({ error: "Even with Firecrawl the page returned almost no text. Try the direct PDF/image link.", text_length: text.length }, 422);
    }
  }

  const { data: batch, error: bErr } = await admin
    .from("flyer_extraction_batches")
    .insert({
      store_id: store_id ?? null,
      admin_user_id: actingUserId,
      original_filename: url.slice(0, 200),
      stored_file_url: "url-html",
      file_type: "text/html",
      flyer_valid_from: flyerValidFrom,
      flyer_valid_until: flyerValidUntil,
      extraction_status: "processing",
      source_url: url,
      requires_confirmation: true,
    } as any).select("id").single();
  if (bErr || !batch) return json({ error: bErr?.message ?? "batch insert failed" }, 500);

  await admin.storage.from("flyer-uploads")
    .upload(`${batch.id}/page.txt`, new TextEncoder().encode(text), { contentType: "text/plain", upsert: true });
  await admin.from("flyer_extraction_batches").update({ stored_file_url: `${batch.id}/page.txt` }).eq("id", batch.id);

  const sysPrompt = [
    "You extract sale items from a grocery store's weekly-ad page (plain text scraped from HTML).",
    "Also identify which store/location this page is for and the validity window if printed.",
    "Be exhaustive on items with a clear price. Lowercase generic food_name, no brand.",
    "Only set regular_price_usd when a was/regular price is shown.",
    "Skip nav links, ads with no price, non-grocery items.",
    "For store_hint, copy name/chain/address/city/state/zip exactly as printed.",
    "For valid_from / valid_until, parse any 'valid' / 'effective' / 'sale dates' line into ISO YYYY-MM-DD.",
  ].join(" ");

  const userPrompt = `Source URL: ${url}\n\nPage text:\n${text.slice(0, 60000)}`;

  const t0 = Date.now();
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "record_deals" } },
    }),
  });
  const latency = Date.now() - t0;
  if (!aiResp.ok) {
    const t = await aiResp.text();
    await logAiUsage({ userId: actingUserId, functionName: FN, model: MODEL, latencyMs: latency, status: "error", error: `${aiResp.status}` });
    await admin.from("flyer_extraction_batches").update({
      extraction_status: "failed", extraction_notes: `ai ${aiResp.status}: ${t.slice(0, 240)}`,
    }).eq("id", batch.id);
    if (aiResp.status === 429) return json({ error: "Rate limited. Try again in a minute." }, 429);
    if (aiResp.status === 402) return json({ error: "AI credits exhausted." }, 402);
    return json({ error: "AI extraction failed" }, 500);
  }

  const aiJson = await aiResp.json();
  const usage = aiJson.usage ?? {};
  let parsedDeals: any[] = [];
  let storeHint: any = null;
  let aiValidFrom: string | null = null;
  let aiValidUntil: string | null = null;
  try {
    const args = JSON.parse(aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}");
    parsedDeals = Array.isArray(args.deals) ? args.deals : [];
    storeHint = args.store_hint && typeof args.store_hint === "object" ? args.store_hint : null;
    aiValidFrom = normalizeDate(args.valid_from);
    aiValidUntil = normalizeDate(args.valid_until);
  } catch (e) { console.error("tool args parse failed", e); }

  await logAiUsage({
    userId: actingUserId, functionName: FN, model: MODEL,
    promptTokens: usage.prompt_tokens ?? 0, completionTokens: usage.completion_tokens ?? 0, latencyMs: latency,
  });

  // Fuzzy-match store_hint against specialty_stores.
  const match = await matchStoreByHint(admin, storeHint, url);

  const cleanDeals = parsedDeals.map(sanitizeDeal).filter(Boolean).slice(0, 200);

  await admin.from("flyer_extraction_batches").update({
    extraction_status: "awaiting_confirmation",
    extracted_items_count: cleanDeals.length,
    pending_deals: cleanDeals,
    extracted_store_hint: storeHint,
    store_match_candidates: match.candidates,
    store_match_confidence: match.confidence,
    extracted_valid_from: aiValidFrom,
    extracted_valid_until: aiValidUntil,
    store_id: store_id ?? (match.confidence === "high" ? match.bestId : null),
    completed_at: null,
  }).eq("id", batch.id);

  return json({
    ok: true, mode: usedFirecrawl ? "html+firecrawl" : "html", batch_id: batch.id,
    extracted: { extracted: cleanDeals.length, raw_returned: parsedDeals.length },
    store_match_confidence: match.confidence,
  });
});

// ---------- helpers ----------

function normalizeDate(v: any): string | null {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function sanitizeDeal(d: any) {
  const sale = Number(d?.sale_price_usd);
  const food = String(d?.food_name ?? "").toLowerCase().slice(0, 80).trim();
  const title = String(d?.title ?? "").slice(0, 160).trim();
  if (!food || !title || !Number.isFinite(sale) || sale <= 0) return null;
  const reg = d.regular_price_usd != null ? Number(d.regular_price_usd) : null;
  const savings = reg && reg > sale ? Math.round(((reg - sale) / reg) * 100) : null;
  return {
    food_name: food, title, sale_price_usd: sale,
    regular_price_usd: Number.isFinite(reg as number) ? (reg as number) : null,
    savings_pct: savings,
    pack_size: d.pack_size ?? null,
    category: d.category ?? null,
  };
}

type StoreMatch = {
  bestId: string | null;
  confidence: "high" | "low" | "none";
  candidates: Array<{ id: string; name: string; chain_name: string | null; city: string | null; region: string | null; score: number }>;
};

async function matchStoreByHint(admin: any, hint: any, url: string): Promise<StoreMatch> {
  const name = String(hint?.name ?? "").trim();
  const chain = String(hint?.chain_name ?? "").trim();
  const city = String(hint?.city ?? "").trim();
  const region = String(hint?.region ?? "").trim();
  const zip = String(hint?.zip ?? "").trim();

  // Also: try the URL domain as an extra signal.
  let domain = "";
  try { domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch {}

  if (!name && !chain && !zip && !domain) return { bestId: null, confidence: "none", candidates: [] };

  const filters: string[] = [];
  if (chain) filters.push(`chain_name.ilike.%${chain}%`);
  if (name)  filters.push(`name.ilike.%${name}%`);
  if (zip)   filters.push(`zip_code.eq.${zip}`);

  let q = admin.from("specialty_stores")
    .select("id, name, chain_name, city, region, zip_code")
    .eq("active", true).limit(20);
  if (filters.length) q = q.or(filters.join(","));
  const { data: pool } = await q;
  let rows = (pool ?? []) as any[];

  // Add alias match for the URL domain
  if (domain) {
    const { data: aliased } = await admin.from("store_email_aliases")
      .select("store_id").eq("match_type", "from_domain").eq("match_value", domain).maybeSingle();
    if (aliased?.store_id && !rows.some((r) => r.id === aliased.store_id)) {
      const { data: aliasStore } = await admin.from("specialty_stores")
        .select("id, name, chain_name, city, region, zip_code").eq("id", aliased.store_id).maybeSingle();
      if (aliasStore) rows = [aliasStore, ...rows];
    }
  }
  if (!rows.length) return { bestId: null, confidence: "none", candidates: [] };

  const scored = rows.map((s) => {
    let score = 0;
    if (name && s.name?.toLowerCase().includes(name.toLowerCase())) score += 3;
    if (chain && s.chain_name?.toLowerCase() === chain.toLowerCase()) score += 3;
    else if (chain && s.chain_name?.toLowerCase().includes(chain.toLowerCase())) score += 2;
    if (city && s.city?.toLowerCase() === city.toLowerCase()) score += 2;
    if (region && s.region?.toLowerCase() === region.toLowerCase()) score += 1;
    if (zip && s.zip_code === zip) score += 4;
    return { id: s.id, name: s.name, chain_name: s.chain_name, city: s.city, region: s.region, score };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  if (!scored.length) return { bestId: null, confidence: "none", candidates: [] };
  const top = scored[0];
  const second = scored[1]?.score ?? 0;
  const confidence: "high" | "low" = (top.score >= 5 && top.score - second >= 2) ? "high" : "low";
  return { bestId: top.id, confidence, candidates: scored.slice(0, 5) };
}

function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function safeJson(req: Request): Promise<any> { try { return await req.json(); } catch { return {}; } }
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
