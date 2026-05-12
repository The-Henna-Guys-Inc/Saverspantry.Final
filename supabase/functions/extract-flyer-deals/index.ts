// Admin-only: extract structured deals from an uploaded flyer (PDF or image)
// using Lovable AI Gateway with vision + tool calling, then insert each deal
// as a sale_observation in pending_review status.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { logAiUsage, getUserIdFromAuth } from "../_shared/aiUsage.ts";

const BodySchema = z.object({ batch_id: z.string().uuid() });

const MODEL = "google/gemini-2.5-flash"; // multimodal, cost-efficient
const FN = "extract-flyer-deals";

const tool = {
  type: "function",
  function: {
    name: "record_deals",
    description: "Record every distinct sale/deal item visible in the flyer.",
    parameters: {
      type: "object",
      properties: {
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
                enum: ["produce", "meat", "seafood", "dairy", "bakery", "pantry", "frozen", "beverage", "snack", "household", "other"],
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
    const userId = await getUserIdFromAuth(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

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
    if (batch.extraction_status === "completed") {
      return json({ error: "Batch already processed", batch_id }, 409);
    }

    // Mark in-progress
    await admin.from("flyer_extraction_batches").update({ extraction_status: "processing" }).eq("id", batch_id);

    // Download the file from storage
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

    const { data: store } = await admin
      .from("specialty_stores")
      .select("name, chain_name, city, region")
      .eq("id", batch.store_id)
      .maybeSingle();

    const sysPrompt = [
      "You extract sale items from a grocery flyer image or PDF page.",
      "Be exhaustive: capture every distinct sale item you can read.",
      "Use the printed sale price. Only set regular_price_usd when you can clearly see a was/regular price.",
      "Lowercase generic food_name with no brand (e.g. 'chicken breast', not 'Tyson chicken breast').",
      "If a unit price like '$1.99/lb' is shown, set sale_price_usd=1.99 and pack_size='1 lb'.",
      "Skip ads with no price or non-grocery items (gift cards, services).",
    ].join(" ");

    const userPrompt = `Store: ${store?.name ?? "Unknown"}${store?.chain_name ? ` (${store.chain_name})` : ""}${store?.city ? ` — ${store.city}, ${store.region ?? ""}` : ""}.\nExtract every sale item.`;

    const t0 = Date.now();
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: sysPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
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
    try {
      const args = JSON.parse(call?.function?.arguments ?? "{}");
      parsedDeals = Array.isArray(args.deals) ? args.deals : [];
    } catch (e) {
      console.error("tool args parse failed", e);
    }

    // Cost tracking
    await logAiUsage({
      userId, functionName: FN, model: MODEL,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      latencyMs: latency,
    });

    // Insert deals — pending_review, linked to batch
    const validUntil = batch.flyer_valid_until ? new Date(batch.flyer_valid_until) : new Date(Date.now() + 7 * 86400000);
    const rows = parsedDeals.slice(0, 200).map((d) => {
      const sale = Number(d.sale_price_usd);
      const reg = d.regular_price_usd != null ? Number(d.regular_price_usd) : null;
      const savings = reg && reg > sale ? Math.round(((reg - sale) / reg) * 100) : null;
      return {
        food_name: String(d.food_name ?? "").toLowerCase().slice(0, 80),
        title: String(d.title ?? "").slice(0, 160),
        store_id: batch.store_id,
        store_name: store?.name ?? "Unknown",
        store_chain: store?.chain_name ?? null,
        city: store?.city ?? null,
        region: store?.region ?? null,
        sale_price_usd: sale,
        regular_price_usd: reg,
        savings_pct: savings,
        pack_size: d.pack_size ?? null,
        category: d.category ?? null,
        starts_at: batch.flyer_valid_from ?? new Date().toISOString(),
        ends_at: validUntil.toISOString(),
        source: "admin_curated",
        moderation_status: "pending_review",
        extraction_batch_id: batch_id,
        approved_by_admin_id: userId,
      };
    }).filter((r) => r.food_name && r.title && Number.isFinite(r.sale_price_usd) && r.sale_price_usd > 0);

    let inserted = 0;
    if (rows.length) {
      const { error: insErr, count } = await admin
        .from("sale_observations")
        .insert(rows, { count: "exact" });
      if (insErr) {
        console.error("insert deals failed:", insErr);
        await admin.from("flyer_extraction_batches").update({
          extraction_status: "failed",
          extraction_notes: `insert: ${insErr.message}`,
        }).eq("id", batch_id);
        return json({ error: "Could not save extracted deals" }, 500);
      }
      inserted = count ?? rows.length;
    }

    const cost = (aiJson.usage && (aiJson.usage.prompt_tokens || aiJson.usage.completion_tokens))
      ? estimateRoughCost(MODEL, aiJson.usage.prompt_tokens ?? 0, aiJson.usage.completion_tokens ?? 0)
      : 0;

    await admin.from("flyer_extraction_batches").update({
      extraction_status: "completed",
      extracted_items_count: rows.length,
      ai_cost_usd: cost,
      completed_at: new Date().toISOString(),
    }).eq("id", batch_id);

    return json({ ok: true, batch_id, extracted: rows.length, inserted, raw_returned: parsedDeals.length });
  } catch (e) {
    console.error("extract-flyer-deals fatal:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function estimateRoughCost(model: string, p: number, c: number): number {
  // Mirrors aiUsage.ts pricing (kept local to avoid circular imports of new tables).
  const PR: Record<string, { input: number; output: number }> = {
    "google/gemini-2.5-flash": { input: 0.000075, output: 0.0003 },
    "google/gemini-2.5-pro":   { input: 0.00125,  output: 0.005 },
  };
  const r = PR[model] ?? { input: 0.0005, output: 0.002 };
  return (p / 1000) * r.input + (c / 1000) * r.output;
}
