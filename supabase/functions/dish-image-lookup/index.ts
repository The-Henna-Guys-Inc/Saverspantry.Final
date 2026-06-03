// Generate a photorealistic plated-dish image via the Lovable AI Gateway
// (Nano Banana / google/gemini-2.5-flash-image), cache it in the public
// `dish-images` storage bucket, and return the public URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { requireUserId, unauthorized } from "../_shared/userAuth.ts";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const BUCKET = "dish-images";

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "dish";

const dataUrlToBytes = (dataUrl: string): { bytes: Uint8Array; contentType: string } => {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("invalid data url");
  const contentType = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, contentType };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const userId = await requireUserId(req);
  if (!userId) return unauthorized(corsHeaders);
  try {
    const { dish, cuisine } = await req.json();
    if (!dish || typeof dish !== "string") {
      return new Response(JSON.stringify({ error: "dish required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // v2 = plated-dish prompt (bust old cached ingredient images)
    const path = `v2/${slug(cuisine ?? "any")}/${slug(dish)}.png`;
    const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    // If already cached, return immediately.
    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) {
      return new Response(JSON.stringify({ url: publicUrl, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a plated-dish photo. Be very explicit so we never get raw ingredients.
    const prompt = `A high-quality, appetizing food photograph of a freshly prepared, fully cooked and plated serving of "${dish}"${cuisine ? ` (${cuisine} cuisine)` : ""}. Show the finished dish ready to eat on a clean plate or bowl, restaurant-style overhead or 45-degree angle, natural soft lighting, shallow depth of field. Do NOT show raw ingredients, packaging, text, watermarks, hands, or people — only the finished dish.`;

    const aiResp = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("ai gateway error", aiResp.status, t);
      throw new Error(`AI ${aiResp.status}`);
    }
    const aiJson = await aiResp.json();
    const dataUrl: string | undefined = aiJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl) {
      console.error("no image in AI response", JSON.stringify(aiJson).slice(0, 500));
      return new Response(JSON.stringify({ url: null, error: "no_image" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bytes, contentType } = dataUrlToBytes(dataUrl);
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) {
      console.error("upload error", upErr);
      throw upErr;
    }

    return new Response(JSON.stringify({ url: publicUrl, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("dish-image-lookup error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
