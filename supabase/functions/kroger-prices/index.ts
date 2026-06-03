// Kroger real-price lookup. Takes a ZIP and a list of grocery items,
// returns the best-match product + price for each at the nearest Kroger store.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { requireUserId, unauthorized } from "../_shared/userAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KROGER_BASE = "https://api.kroger.com/v1";

let cachedToken: { token: string; expires: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 30_000) return cachedToken.token;
  const id = Deno.env.get("KROGER_CLIENT_ID");
  const secret = Deno.env.get("KROGER_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Kroger credentials not configured");
  const basic = btoa(`${id}:${secret}`);
  const resp = await fetch(`${KROGER_BASE}/connect/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=product.compact",
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Kroger token error ${resp.status}: ${t}`);
  }
  const j = await resp.json();
  cachedToken = { token: j.access_token, expires: Date.now() + (j.expires_in ?? 1800) * 1000 };
  return cachedToken.token;
}

async function findLocation(token: string, zip: string): Promise<{ id: string; name: string; chain: string } | null> {
  const url = `${KROGER_BASE}/locations?filter.zipCode.near=${encodeURIComponent(zip)}&filter.limit=1`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const j = await r.json();
  const loc = j?.data?.[0];
  if (!loc) return null;
  return { id: loc.locationId, name: loc.name, chain: loc.chain };
}

async function findProduct(token: string, term: string, locationId: string) {
  const url = `${KROGER_BASE}/products?filter.term=${encodeURIComponent(term)}&filter.locationId=${locationId}&filter.limit=1`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const j = await r.json();
  const p = j?.data?.[0];
  if (!p) return null;
  const item0 = p.items?.[0];
  const price = item0?.price?.promo && item0.price.promo > 0 ? item0.price.promo : item0?.price?.regular;
  if (!price) return null;
  const img = p.images?.find((i: any) => i.featured)?.sizes?.find((s: any) => s.size === "medium")?.url
    ?? p.images?.[0]?.sizes?.[0]?.url ?? null;
  return {
    product_name: p.description as string,
    brand: p.brand as string | undefined,
    size: item0?.size as string | undefined,
    price_usd: price as number,
    on_sale: !!(item0?.price?.promo && item0.price.promo > 0 && item0.price.promo < item0.price.regular),
    regular_price_usd: item0?.price?.regular as number | undefined,
    image: img,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const userId = await requireUserId(req);
  if (!userId) return unauthorized(corsHeaders);
  try {
    const { zip, items } = await req.json();
    if (!zip || !Array.isArray(items) || !items.length) {
      return new Response(JSON.stringify({ error: "Missing zip or items" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = await getToken();
    const location = await findLocation(token, String(zip));
    if (!location) {
      return new Response(JSON.stringify({ error: "No Kroger-family store found near that ZIP", store: null, prices: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Cap to 25 to keep latency reasonable
    const capped = items.slice(0, 25);
    const results = await Promise.all(capped.map(async (it: any) => {
      const term = String(it.item || "").trim();
      if (!term) return { item: term, match: null };
      try {
        const match = await findProduct(token, term, location.id);
        return { item: term, match };
      } catch {
        return { item: term, match: null };
      }
    }));
    const total = results.reduce((s, r) => s + (r.match?.price_usd ?? 0), 0);
    return new Response(JSON.stringify({ store: location, prices: results, total_usd: total }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("kroger-prices error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
