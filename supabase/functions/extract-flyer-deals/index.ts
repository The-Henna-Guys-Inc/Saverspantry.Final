// Admin-only: extract structured deals from an uploaded flyer (PDF or image)
// using Lovable AI Gateway with vision + tool calling.
//
// Behavior depends on flyer_extraction_batches.requires_confirmation:
//  - true  (admin upload / URL import) → stash deals as pending_deals JSON,
//    set status = 'awaiting_confirmation'. The admin reviews the AI-extracted
//    store + validity dates in a confirm dialog, then confirm-flyer-batch
//    inserts the sale_observations rows.
//  - false (email auto-ingest) → insert sale_observations immediately. If AI
//    confidently extracted a different store than the email alias guessed,
//    we override the batch.store_id before insert.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { logAiUsage, getUserIdFromAuth } from "../_shared/aiUsage.ts";

const BodySchema = z.object({ batch_id: z.string().uuid() });

const MODEL = "google/gemini-2.5-flash";
const FN = "extract-flyer-deals";

const tool = {
  type: "function",
  function: {
    name: "record_deals",
    description: "Record every distinct sale/deal item visible in the flyer, plus the store identity and validity window if printed.",
    parameters: {
      type: "object",
      properties: {
        store_hint: {
          type: ["object", "null"],
          description: "What you can read from the flyer about which store / location it is for.",
          properties: {
            name:        { type: ["string", "null"] },
            chain_name:  { type: ["string", "null"], description: "Parent chain if visible, e.g. 'Kroger', 'Safeway'." },
            address:     { type: ["string", "null"], description: "Street address line if printed." },
            city:        { type: ["string", "null"] },
            region:      { type: ["string", "null"], description: "State or province, 2-letter abbreviation if US." },
            zip:         { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
        valid_from:  { type: ["string", "null"], description: "Flyer start date in YYYY-MM-DD if printed." },
        valid_until: { type: ["string", "null"], description: "Flyer end date in YYYY-MM-DD if printed." },
        deals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              food_name: { type: "string", description: "Generic food (e.g. 'chicken breast', 'gala apples'). Lowercase, no brand." },
              title: { type: "string", description: "Short headline as printed (e.g. 'Boneless Chicken Breast — $1.99/lb')." },
              sale_price_usd: { type: "number" },
              regular_price_usd: { type: ["number", "null"] },
              pack_size: { type: ["string", "null"], description: "Pack/unit size, e.g. '1 lb', '12 oz', '2 ct'." },
              category: {
                type: "string",
                enum: ["produce","meat","seafood","dairy","bakery","pantry","frozen","beverage","snack","household","other"],
              },
            },
            required: ["food_name", "title", "sale_price_usd", "category"],
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

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const auth = req.headers.get("authorization") ?? "";
    const isServiceRole = auth === `Bearer ${serviceKey}`;
    let userId: string | null = null;
    if (!isServiceRole) {
      userId = await getUserIdFromAuth(req);
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (!roleRow) return json({ error: "Forbidden" }, 403);
    }

    if (!apiKey) return json({ error: "AI gateway not configured" }, 500);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { batch_id } = parsed.data;

    const { data: batch, error: bErr } = await admin
      .from("flyer_extraction_batches")
      .select("*")
      .eq("id", batch_id)
      .maybeSingle();
    if (bErr || !batch) return json({ error: "Batch not found" }, 404);
    if (batch.extraction_status === "completed" || batch.extraction_status === "awaiting_confirmation") {
      return json({ error: "Batch already processed", batch_id, status: batch.extraction_status }, 409);
    }

    await admin.from("flyer_extraction_batches").update({ extraction_status: "processing" }).eq("id", batch_id);

    const { data: fileBlob, error: dlErr } = await admin.storage.from("flyer-uploads").download(batch.stored_file_url);
    if (dlErr || !fileBlob) {
      await admin.from("flyer_extraction_batches").update({ extraction_status: "failed", extraction_notes: "download failed" }).eq("id", batch_id);
      return json({ error: "Could not download flyer" }, 500);
    }

    const mime = batch.file_type || fileBlob.type || "application/octet-stream";
    if (!/^image\/|^application\/pdf$/.test(mime)) {
      await admin.from("flyer_extraction_batches").update({ extraction_status: "failed", extraction_notes: `unsupported mime ${mime}` }).eq("id", batch_id);
      return json({ error: "Unsupported file type. Use PDF, JPG, or PNG." }, 400);
    }

    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const b64 = base64Encode(bytes);
    const dataUrl = `data:${mime};base64,${b64}`;

    // Optional context: known store on the batch (email path)
    const { data: ctxStore } = batch.store_id
      ? await admin.from("specialty_stores").select("name, chain_name, city, region").eq("id", batch.store_id).maybeSingle()
      : { data: null };

    const sysPrompt = [
      "You extract sale items from a grocery flyer image or PDF page.",
      "Also identify which store/location the flyer is for and the validity window if printed.",
      "Be exhaustive: capture every distinct sale item you can read.",
      "Use the printed sale price. Only set regular_price_usd when you can clearly see a was/regular price.",
      "Lowercase generic food_name with no brand (e.g. 'chicken breast', not 'Tyson chicken breast').",
      "If a unit price like '$1.99/lb' is shown, set sale_price_usd=1.99 and pack_size='1 lb'.",
      "For store_hint, copy the store name, chain, address, city, state, and zip exactly as printed. Leave fields null if not visible.",
      "For valid_from / valid_until, parse any 'valid' / 'prices good' / 'effective' / 'sale dates' line into ISO YYYY-MM-DD. Use null if not printed.",
      "Skip ads with no price or non-grocery items (gift cards, services).",
    ].join(" ");

    const userPrompt = ctxStore
      ? `Context — this flyer arrived via an email mapped to: ${ctxStore.name}${ctxStore.chain_name ? ` (${ctxStore.chain_name})` : ""}${ctxStore.city ? ` — ${ctxStore.city}, ${ctxStore.region ?? ""}` : ""}. Confirm or correct that from the flyer itself.\nExtract every sale item, the store identity, and the validity window.`
      : `Extract every sale item, the store identity (name, chain, address, city, state, zip), and the validity window.`;

    const t0 = Date.now();
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ] },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "record_deals" } },
      }),
    });

    const latency = Date.now() - t0;
    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, text);
      await logAiUsage({ userId, functionName: FN, model: MODEL, latencyMs: latency, status: "error", error: `${aiResp.status}` });
      await admin.from("flyer_extraction_batches").update({
        extraction_status: "failed",
        extraction_notes: `ai ${aiResp.status}: ${text.slice(0, 240)}`,
      }).eq("id", batch_id);
      if (aiResp.status === 429) return json({ error: "Rate limited. Try again in a minute." }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted. Add funds in workspace settings." }, 402);
      return json({ error: "AI extraction failed" }, 500);
    }

    const aiJson = await aiResp.json();
    const usage = aiJson.usage ?? {};
    const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    let parsedDeals: any[] = [];
    let storeHint: any = null;
    let aiValidFrom: string | null = null;
    let aiValidUntil: string | null = null;
    try {
      const args = JSON.parse(call?.function?.arguments ?? "{}");
      parsedDeals = Array.isArray(args.deals) ? args.deals : [];
      storeHint = args.store_hint && typeof args.store_hint === "object" ? args.store_hint : null;
      aiValidFrom = normalizeDate(args.valid_from);
      aiValidUntil = normalizeDate(args.valid_until);
    } catch (e) {
      console.error("tool args parse failed", e);
    }

    await logAiUsage({
      userId, functionName: FN, model: MODEL,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      latencyMs: latency,
    });

    const cost = estimateRoughCost(MODEL, usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0);

    // Fuzzy-match store_hint against specialty_stores.
    const match = await matchStoreByHint(admin, storeHint);

    // ---- Branch on requires_confirmation ----
    if (batch.requires_confirmation) {
      // Stash deals; don't insert yet.
      const cleanDeals = parsedDeals
        .map((d) => sanitizeDeal(d))
        .filter(Boolean)
        .slice(0, 200);

      await admin.from("flyer_extraction_batches").update({
        extraction_status: "awaiting_confirmation",
        extracted_items_count: cleanDeals.length,
        pending_deals: cleanDeals,
        extracted_store_hint: storeHint,
        store_match_candidates: match.candidates,
        store_match_confidence: match.confidence,
        extracted_valid_from: aiValidFrom,
        extracted_valid_until: aiValidUntil,
        // If AI is high-confidence and batch has no store yet, pre-set it as a suggestion.
        store_id: batch.store_id ?? (match.confidence === "high" ? match.bestId : null),
        ai_cost_usd: cost,
      }).eq("id", batch_id);

      return json({
        ok: true, batch_id, mode: "awaiting_confirmation",
        extracted: cleanDeals.length, raw_returned: parsedDeals.length,
        store_match_confidence: match.confidence,
      });
    }

    // ---- Email path: insert immediately, allow AI store override ----
    let effectiveStoreId = batch.store_id;
    let overrideNote: string | null = null;
    if (match.confidence === "high" && match.bestId && match.bestId !== batch.store_id) {
      effectiveStoreId = match.bestId;
      overrideNote = `Store overridden by AI: ${storeHint?.name ?? "?"} → ${match.bestId}`;
    }
    if (!effectiveStoreId) {
      await admin.from("flyer_extraction_batches").update({
        extraction_status: "failed",
        extraction_notes: "no store could be resolved",
        extracted_store_hint: storeHint,
        store_match_candidates: match.candidates,
        store_match_confidence: match.confidence,
      }).eq("id", batch_id);
      return json({ error: "No store could be resolved", batch_id }, 422);
    }

    const { data: storeRow } = await admin
      .from("specialty_stores")
      .select("name, chain_name, city, region")
      .eq("id", effectiveStoreId)
      .maybeSingle();

    const effFrom = aiValidFrom ? new Date(aiValidFrom).toISOString()
      : (batch.flyer_valid_from ?? new Date().toISOString());
    const effUntil = aiValidUntil ? new Date(aiValidUntil + "T23:59:59Z").toISOString()
      : (batch.flyer_valid_until ?? new Date(Date.now() + 7 * 86400000).toISOString());

    const rows = parsedDeals.map((d) => {
      const c = sanitizeDeal(d);
      if (!c) return null;
      return {
        food_name: c.food_name,
        title: c.title,
        store_id: effectiveStoreId,
        store_name: storeRow?.name ?? "Unknown",
        store_chain: storeRow?.chain_name ?? null,
        city: storeRow?.city ?? null,
        region: storeRow?.region ?? null,
        sale_price_usd: c.sale_price_usd,
        regular_price_usd: c.regular_price_usd,
        savings_pct: c.savings_pct,
        pack_size: c.pack_size,
        category: c.category,
        starts_at: effFrom,
        ends_at: effUntil,
        source: "admin_curated",
        moderation_status: "pending_review",
        extraction_batch_id: batch_id,
        approved_by_admin_id: userId,
      };
    }).filter(Boolean).slice(0, 200) as any[];

    let inserted = 0;
    if (rows.length) {
      const { error: insErr, count } = await admin
        .from("sale_observations").insert(rows, { count: "exact" });
      if (insErr) {
        await admin.from("flyer_extraction_batches").update({
          extraction_status: "failed",
          extraction_notes: `insert: ${insErr.message}`,
        }).eq("id", batch_id);
        return json({ error: "Could not save extracted deals" }, 500);
      }
      inserted = count ?? rows.length;
    }

    await admin.from("flyer_extraction_batches").update({
      extraction_status: "completed",
      extracted_items_count: rows.length,
      ai_cost_usd: cost,
      completed_at: new Date().toISOString(),
      store_id: effectiveStoreId,
      extracted_store_hint: storeHint,
      store_match_candidates: match.candidates,
      store_match_confidence: match.confidence,
      extracted_valid_from: aiValidFrom,
      extracted_valid_until: aiValidUntil,
      flyer_valid_from: effFrom,
      flyer_valid_until: effUntil,
      extraction_notes: overrideNote,
    }).eq("id", batch_id);

    return json({ ok: true, batch_id, mode: "inserted", extracted: rows.length, inserted, raw_returned: parsedDeals.length, store_override: !!overrideNote });
  } catch (e) {
    console.error("extract-flyer-deals fatal:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

// ---------- helpers ----------

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function normalizeDate(v: any): string | null {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function sanitizeDeal(d: any): {
  food_name: string; title: string; sale_price_usd: number;
  regular_price_usd: number | null; savings_pct: number | null;
  pack_size: string | null; category: string | null;
} | null {
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

async function matchStoreByHint(admin: any, hint: any): Promise<StoreMatch> {
  if (!hint || typeof hint !== "object") return { bestId: null, confidence: "none", candidates: [] };

  const name = String(hint.name ?? "").trim();
  const chain = String(hint.chain_name ?? "").trim();
  const city = String(hint.city ?? "").trim();
  const region = String(hint.region ?? "").trim();
  const zip = String(hint.zip ?? "").trim();

  if (!name && !chain && !zip) return { bestId: null, confidence: "none", candidates: [] };

  // Pull a pool of candidates by chain or zip — keep small.
  const filters: string[] = [];
  if (chain) filters.push(`chain_name.ilike.%${chain}%`);
  if (name)  filters.push(`name.ilike.%${name}%`);
  if (zip)   filters.push(`zip_code.eq.${zip}`);

  let q = admin.from("specialty_stores")
    .select("id, name, chain_name, city, region, zip_code")
    .eq("active", true).limit(20);
  if (filters.length) q = q.or(filters.join(","));
  const { data: pool } = await q;
  const rows = (pool ?? []) as any[];
  if (!rows.length) return { bestId: null, confidence: "none", candidates: [] };

  // Simple scoring: name match + chain match + city + zip.
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
  // High confidence: clear top score (>=5) and well-separated from runner-up.
  const confidence: "high" | "low" = (top.score >= 5 && top.score - second >= 2) ? "high" : "low";
  return { bestId: top.id, confidence, candidates: scored.slice(0, 5) };
}

function estimateRoughCost(model: string, p: number, c: number): number {
  const PR: Record<string, { input: number; output: number }> = {
    "google/gemini-2.5-flash": { input: 0.000075, output: 0.0003 },
    "google/gemini-2.5-pro":   { input: 0.00125,  output: 0.005 },
  };
  const r = PR[model] ?? { input: 0.0005, output: 0.002 };
  return (p / 1000) * r.input + (c / 1000) * r.output;
}
