// Admin-only: import a flyer from a URL. PDF/image links are downloaded and
// run through the existing flyer extraction pipeline. HTML pages are fetched
// as plain text and parsed with an LLM (no Firecrawl/JS rendering). Pages that
// rely on JS to render their flyer (Flipp/Circular.com/etc.) will return little
// usable text — we surface that to the admin.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { logAiUsage } from "../_shared/aiUsage.ts";

const BodySchema = z.object({
  url: z.string().url(),
  store_id: z.string().uuid(),
  valid_from: z.string().min(1),
  valid_until: z.string().min(1),
});

const MAX_BYTES = 20 * 1024 * 1024;
const MODEL = "google/gemini-2.5-flash";
const FN = "import-flyer-from-url";

const tool = {
  type: "function",
  function: {
    name: "record_deals",
    description: "Record every distinct sale/deal item visible in the flyer page text.",
    parameters: {
      type: "object",
      properties: {
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

  // Auth: admin only
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing auth" }, 401);
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "invalid auth" }, 401);
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const { data: roleRow } = await admin.from("user_roles").select("role")
    .eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ error: "admin only" }, 403);

  const parsed = BodySchema.safeParse(await safeJson(req));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const { url, store_id, valid_from, valid_until } = parsed.data;

  // Fetch the URL
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

  const { data: store } = await admin.from("specialty_stores")
    .select("name, chain_name, city, region").eq("id", store_id).maybeSingle();
  if (!store) return json({ error: "Store not found" }, 404);

  // ---- PDF / image: reuse the existing extraction pipeline ----
  if (isPdf || isImg) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return json({ error: "File >20MB" }, 400);
    const ext = isPdf ? "pdf" : (contentType.split("/")[1] || "bin");

    const { data: batch, error: bErr } = await admin
      .from("flyer_extraction_batches")
      .insert({
        store_id, admin_user_id: userRes.user.id,
        original_filename: url.split("/").pop()?.slice(0, 200) || "url-import",
        stored_file_url: "pending",
        file_type: contentType,
        flyer_valid_from: new Date(valid_from).toISOString(),
        flyer_valid_until: new Date(valid_until).toISOString(),
        extraction_status: "pending",
        source_url: url,
      } as any).select("id").single();
    if (bErr || !batch) return json({ error: bErr?.message ?? "batch insert failed" }, 500);

    const path = `${batch.id}/flyer.${ext}`;
    const { error: upErr } = await admin.storage.from("flyer-uploads")
      .upload(path, buf, { contentType, upsert: true });
    if (upErr) return json({ error: `upload: ${upErr.message}` }, 500);
    await admin.from("flyer_extraction_batches").update({ stored_file_url: path }).eq("id", batch.id);

    // Invoke extract-flyer-deals service-role-style
    const extractRes = await fetch(`${supaUrl}/functions/v1/extract-flyer-deals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ batch_id: batch.id }),
    });
    const extracted = await extractRes.json().catch(() => ({}));
    return json({ ok: extractRes.ok, mode: isPdf ? "pdf" : "image", batch_id: batch.id, extracted });
  }

  // ---- HTML: fetch text, ask the LLM to extract deals ----
  if (!isHtml) return json({ error: `Unsupported content-type: ${contentType || "unknown"}` }, 400);
  if (!apiKey) return json({ error: "AI gateway not configured" }, 500);

  const html = await res.text();
  const text = stripHtml(html);
  if (text.length < 300) {
    return json({
      error: "Page returned almost no text. It likely renders the flyer with JavaScript (Flipp, Circular.com, etc.), which this importer can't read. Try the direct PDF/image link if the site offers one.",
      text_length: text.length,
    }, 422);
  }

  // Create batch
  const { data: batch, error: bErr } = await admin
    .from("flyer_extraction_batches")
    .insert({
      store_id, admin_user_id: userRes.user.id,
      original_filename: url.slice(0, 200),
      stored_file_url: "url-html",
      file_type: "text/html",
      flyer_valid_from: new Date(valid_from).toISOString(),
      flyer_valid_until: new Date(valid_until).toISOString(),
      extraction_status: "processing",
      source_url: url,
    } as any).select("id").single();
  if (bErr || !batch) return json({ error: bErr?.message ?? "batch insert failed" }, 500);

  // Store the cleaned text as a record we can re-process later
  await admin.storage.from("flyer-uploads")
    .upload(`${batch.id}/page.txt`, new TextEncoder().encode(text), {
      contentType: "text/plain", upsert: true,
    });
  await admin.from("flyer_extraction_batches").update({ stored_file_url: `${batch.id}/page.txt` }).eq("id", batch.id);

  const sysPrompt = [
    "You extract sale items from a grocery store's weekly-ad page (plain text scraped from HTML).",
    "Be exhaustive: capture every distinct sale item with a clear price.",
    "Use the printed sale price. Only set regular_price_usd when a was/regular price is shown.",
    "Lowercase generic food_name with no brand.",
    "If a unit price like '$1.99/lb' is shown, set sale_price_usd=1.99 and pack_size='1 lb'.",
    "Skip nav links, ads with no price, and non-grocery items.",
  ].join(" ");

  const userPrompt = `Store: ${store.name}${store.chain_name ? ` (${store.chain_name})` : ""}${store.city ? ` — ${store.city}, ${store.region ?? ""}` : ""}.\nSource URL: ${url}\n\nPage text:\n${text.slice(0, 60000)}`;

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
    await logAiUsage({ userId: userRes.user.id, functionName: FN, model: MODEL, latencyMs: latency, status: "error", error: `${aiResp.status}` });
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
  try {
    const args = JSON.parse(aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}");
    parsedDeals = Array.isArray(args.deals) ? args.deals : [];
  } catch (e) { console.error("tool args parse failed", e); }

  await logAiUsage({
    userId: userRes.user.id, functionName: FN, model: MODEL,
    promptTokens: usage.prompt_tokens ?? 0, completionTokens: usage.completion_tokens ?? 0,
    latencyMs: latency,
  });

  const validUntilDate = new Date(valid_until);
  const rows = parsedDeals.slice(0, 200).map((d) => {
    const sale = Number(d.sale_price_usd);
    const reg = d.regular_price_usd != null ? Number(d.regular_price_usd) : null;
    const savings = reg && reg > sale ? Math.round(((reg - sale) / reg) * 100) : null;
    return {
      food_name: String(d.food_name ?? "").toLowerCase().slice(0, 80),
      title: String(d.title ?? "").slice(0, 160),
      store_id, store_name: store.name, store_chain: store.chain_name ?? null,
      city: store.city ?? null, region: store.region ?? null,
      sale_price_usd: sale, regular_price_usd: reg, savings_pct: savings,
      pack_size: d.pack_size ?? null, category: d.category ?? null,
      starts_at: new Date(valid_from).toISOString(), ends_at: validUntilDate.toISOString(),
      source: "admin_curated", moderation_status: "pending_review",
      extraction_batch_id: batch.id, approved_by_admin_id: userRes.user.id,
    };
  }).filter((r) => r.food_name && r.title && Number.isFinite(r.sale_price_usd) && r.sale_price_usd > 0);

  let inserted = 0;
  if (rows.length) {
    const { error: insErr, count } = await admin.from("sale_observations").insert(rows, { count: "exact" });
    if (insErr) {
      await admin.from("flyer_extraction_batches").update({
        extraction_status: "failed", extraction_notes: `insert: ${insErr.message}`,
      }).eq("id", batch.id);
      return json({ error: "Could not save extracted deals" }, 500);
    }
    inserted = count ?? rows.length;
  }

  await admin.from("flyer_extraction_batches").update({
    extraction_status: "completed",
    extracted_items_count: rows.length,
    completed_at: new Date().toISOString(),
  }).eq("id", batch.id);

  return json({ ok: true, mode: "html", batch_id: batch.id, extracted: rows.length, inserted });
});

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
