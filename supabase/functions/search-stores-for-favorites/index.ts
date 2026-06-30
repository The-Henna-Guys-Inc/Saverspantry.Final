// Search grocery stores by free-text name for the favorites picker.
// Looks up curated specialty_stores first, then falls back to Google Places
// (text search). Places hits are upserted into specialty_stores so they
// have a stable UUID we can save on the user's profile.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function pickAddressPart(components: any[] | undefined, type: string): string | null {
  if (!components) return null;
  const c = components.find((x) => (x.types ?? []).includes(type));
  return c?.shortText ?? c?.longText ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const rawQuery = String(body?.query ?? "").trim().slice(0, 80);
    const lat = typeof body?.lat === "number" ? body.lat : null;
    const lng = typeof body?.lng === "number" ? body.lng : null;
    const zip = typeof body?.zip === "string" ? body.zip.trim().slice(0, 10) : null;
    if (rawQuery.length < 2) {
      return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1) Curated specialty_stores by name (active only).
    const { data: curated } = await supabase
      .from("specialty_stores")
      .select("id, name, chain_name, address, city, region, zip_code, latitude, longitude, google_place_id")
      .eq("active", true)
      .or(`name.ilike.%${rawQuery}%,chain_name.ilike.%${rawQuery}%`)
      .limit(15);

    const results: Array<{
      id: string;
      name: string;
      chain: string | null;
      address: string | null;
      city: string | null;
      region: string | null;
      zip: string | null;
      source: "curated" | "places";
    }> = (curated ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      chain: s.chain_name,
      address: s.address,
      city: s.city,
      region: s.region,
      zip: s.zip_code,
      source: "curated",
    }));

    // 2) Google Places fallback — only if we have a location hint.
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    let resolvedLat = lat, resolvedLng = lng;
    if (apiKey && (resolvedLat == null || resolvedLng == null) && zip) {
      try {
        const geoRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(zip)}&key=${apiKey}`,
        );
        const geo = await geoRes.json();
        const loc = geo?.results?.[0]?.geometry?.location;
        if (loc) { resolvedLat = loc.lat; resolvedLng = loc.lng; }
      } catch (_e) { /* ignore */ }
    }

    if (apiKey && resolvedLat != null && resolvedLng != null && results.length < 10) {
      try {
        const placesRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents,places.primaryType",
          },
          body: JSON.stringify({
            textQuery: `${rawQuery} grocery store`,
            maxResultCount: 10,
            locationBias: {
              circle: {
                center: { latitude: resolvedLat, longitude: resolvedLng },
                radius: 25000,
              },
            },
          }),
        });
        const placesJson = await placesRes.json();
        const places = placesJson?.places ?? [];
        const existingPlaceIds = new Set((curated ?? []).map((s: any) => s.google_place_id).filter(Boolean));

        for (const p of places) {
          if (!p.id || existingPlaceIds.has(p.id)) continue;
          const name = p.displayName?.text ?? "Unknown";
          const row = {
            google_place_id: p.id,
            name,
            cuisine_specialties: [] as string[],
            price_tier: "unknown",
            address: p.formattedAddress ?? null,
            city: pickAddressPart(p.addressComponents, "locality"),
            region: pickAddressPart(p.addressComponents, "administrative_area_level_1"),
            country: pickAddressPart(p.addressComponents, "country") ?? "US",
            zip_code: pickAddressPart(p.addressComponents, "postal_code"),
            latitude: p.location?.latitude ?? null,
            longitude: p.location?.longitude ?? null,
            last_synced_at: new Date().toISOString(),
            curation_source: "google_places",
          };

          // Upsert so we get back a stable UUID.
          const { data: existing } = await supabase
            .from("specialty_stores")
            .select("id, name, chain_name, address, city, region, zip_code")
            .eq("google_place_id", p.id)
            .maybeSingle();

          let id: string;
          let stored: any;
          if (existing) {
            id = existing.id;
            stored = existing;
          } else {
            const { data: ins, error: insErr } = await supabase
              .from("specialty_stores")
              .insert(row)
              .select("id, name, chain_name, address, city, region, zip_code")
              .single();
            if (insErr || !ins) continue;
            id = ins.id;
            stored = ins;
          }
          results.push({
            id,
            name: stored.name,
            chain: stored.chain_name ?? null,
            address: stored.address,
            city: stored.city,
            region: stored.region,
            zip: stored.zip_code,
            source: "places",
          });
        }
      } catch (e) {
        console.error("Places search failed", e);
      }
    }

    return new Response(JSON.stringify({ results: results.slice(0, 20) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-stores-for-favorites error", e);
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
