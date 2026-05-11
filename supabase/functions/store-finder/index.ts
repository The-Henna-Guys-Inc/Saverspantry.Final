// Google Places-powered specialty grocer finder.
// Searches nearby grocers per cuisine keyword and upserts into specialty_stores.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// cuisine tag → Google Places text query
const CUISINE_QUERIES: Record<string, string> = {
  south_asian: "Indian grocery store",
  pakistani: "Pakistani halal grocery store",
  chinese: "Chinese supermarket",
  korean: "Korean market",
  japanese: "Japanese grocery store",
  vietnamese: "Vietnamese grocery store",
  thai: "Thai grocery store",
  filipino: "Filipino grocery store",
  southeast_asian: "Asian supermarket",
  mexican: "Mexican grocery store",
  latin_american: "Latin grocery supermercado",
  middle_eastern: "Middle Eastern halal market",
  mediterranean: "Mediterranean grocery store",
  african: "African grocery store",
};

// Reverse: keyword in name → cuisine tags (rough heuristic for tagging results)
function inferCuisines(name: string, query: string, queryCuisine: string): string[] {
  const tags = new Set<string>([queryCuisine]);
  const n = name.toLowerCase();
  if (/\b(indian|patel|punjab|desi|bharat)\b/.test(n)) tags.add("south_asian");
  if (/\b(pakistan|halal)\b/.test(n)) tags.add("pakistani");
  if (/\b(china|chinese|asian|hmart|99 ranch|h mart)\b/.test(n)) tags.add("chinese");
  if (/\b(korea|korean|hmart|h mart)\b/.test(n)) { tags.add("korean"); }
  if (/\b(japan|japanese|nijiya|mitsuwa)\b/.test(n)) tags.add("japanese");
  if (/\b(viet|vietnam)\b/.test(n)) tags.add("vietnamese");
  if (/\b(thai)\b/.test(n)) tags.add("thai");
  if (/\b(filipino|seafood city|island pacific)\b/.test(n)) tags.add("filipino");
  if (/\b(mexic|carniceria|supermercado|tortill|el super|vallarta|cardenas|northgate)\b/.test(n)) tags.add("mexican");
  if (/\b(latin|colombia|peru|salvador|honduras)\b/.test(n)) tags.add("latin_american");
  if (/\b(arab|persian|iranian|lebanese|turkish|sahara|halal)\b/.test(n)) tags.add("middle_eastern");
  if (/\b(mediterranean|greek)\b/.test(n)) tags.add("mediterranean");
  if (/\b(africa|nigeri|ethiop|somali|ghana)\b/.test(n)) tags.add("african");
  return [...tags];
}

function metersFromMiles(miles: number) {
  return Math.min(50000, Math.round(miles * 1609.34));
}

async function placesSearch(apiKey: string, query: string, lat: number, lng: number, radiusMeters: number) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 10,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters } },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${res.status}: ${text}`);
  }
  return await res.json();
}

function priceTier(priceLevel?: string): string {
  // PRICE_LEVEL_INEXPENSIVE / MODERATE / EXPENSIVE / VERY_EXPENSIVE
  if (!priceLevel) return "unknown";
  if (priceLevel.includes("INEXPENSIVE")) return "low";
  if (priceLevel.includes("MODERATE")) return "medium";
  return "high";
}

function pickAddressPart(components: any[] | undefined, type: string): string | null {
  if (!components) return null;
  const c = components.find((x) => (x.types ?? []).includes(type));
  return c?.shortText ?? c?.longText ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const { lat, lng, radius_miles, cuisines } = body as {
      lat?: number; lng?: number; radius_miles?: number; cuisines?: string[];
    };
    if (typeof lat !== "number" || typeof lng !== "number") {
      return new Response(JSON.stringify({ error: "lat and lng required" }), { status: 400, headers: corsHeaders });
    }

    const radius = metersFromMiles(radius_miles ?? 10);
    const targetCuisines = (cuisines && cuisines.length ? cuisines : Object.keys(CUISINE_QUERIES))
      .filter((c) => CUISINE_QUERIES[c]);

    const seen = new Map<string, any>(); // place_id → row
    for (const cuisine of targetCuisines) {
      try {
        const result = await placesSearch(apiKey, CUISINE_QUERIES[cuisine], lat, lng, radius);
        for (const p of result.places ?? []) {
          const placeId = p.id;
          if (!placeId) continue;
          const name = p.displayName?.text ?? "Unknown";
          const tags = inferCuisines(name, CUISINE_QUERIES[cuisine], cuisine);
          const existing = seen.get(placeId);
          if (existing) {
            existing.cuisine_specialties = [...new Set([...existing.cuisine_specialties, ...tags])];
          } else {
            seen.set(placeId, {
              google_place_id: placeId,
              name,
              cuisine_specialties: tags,
              price_tier: priceTier(p.priceLevel),
              address: p.formattedAddress ?? null,
              city: pickAddressPart(p.addressComponents, "locality"),
              region: pickAddressPart(p.addressComponents, "administrative_area_level_1"),
              country: pickAddressPart(p.addressComponents, "country") ?? "US",
              latitude: p.location?.latitude ?? null,
              longitude: p.location?.longitude ?? null,
              google_rating: p.rating ?? null,
              google_rating_count: p.userRatingCount ?? null,
              last_synced_at: new Date().toISOString(),
              curation_source: "google_places",
            });
          }
        }
      } catch (e) {
        console.error("Places query failed", cuisine, e);
      }
    }

    let inserted = 0, updated = 0;
    for (const row of seen.values()) {
      const { data: existing } = await supabase
        .from("specialty_stores")
        .select("id, cuisine_specialties")
        .eq("google_place_id", row.google_place_id)
        .maybeSingle();
      if (existing) {
        const merged = [...new Set([...(existing.cuisine_specialties ?? []), ...row.cuisine_specialties])];
        await supabase
          .from("specialty_stores")
          .update({ ...row, cuisine_specialties: merged })
          .eq("id", existing.id);
        updated++;
      } else {
        const { error } = await supabase.from("specialty_stores").insert(row);
        if (!error) inserted++;
        else console.error("Insert failed", error.message);
      }
    }

    return new Response(
      JSON.stringify({ inserted, updated, total: seen.size }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("store-finder error", e);
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
