// Nightly cleanup to keep Google Places data within the 30-day cache rule.
// 1. Snapshot all current google_places store IDs into known_google_places (kept forever).
// 2. Delete specialty_stores rows sourced from Google Places older than 30 days.
// 3. Delete places_search_cache rows older than 30 days so they re-fetch.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();

    // 1. Snapshot place IDs (keep forever)
    const { data: stores } = await supabase
      .from("specialty_stores")
      .select("google_place_id")
      .eq("curation_source", "google_places")
      .not("google_place_id", "is", null);

    let snapshotted = 0;
    if (stores && stores.length) {
      const rows = stores
        .filter((s: any) => s.google_place_id)
        .map((s: any) => ({ google_place_id: s.google_place_id, last_seen_at: new Date().toISOString() }));
      if (rows.length) {
        const { error } = await supabase
          .from("known_google_places")
          .upsert(rows, { onConflict: "google_place_id" });
        if (!error) snapshotted = rows.length;
      }
    }

    // 2. Delete stale Google-sourced stores
    const { count: deletedStores } = await supabase
      .from("specialty_stores")
      .delete({ count: "exact" })
      .eq("curation_source", "google_places")
      .lt("last_synced_at", cutoff);

    // 3. Delete stale search cache (forces re-fetch after 30 days)
    const { count: deletedCache } = await supabase
      .from("places_search_cache")
      .delete({ count: "exact" })
      .lt("searched_at", cutoff);

    return new Response(
      JSON.stringify({
        snapshotted,
        deleted_stores: deletedStores ?? 0,
        deleted_cache_entries: deletedCache ?? 0,
        cutoff,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("cleanup-stale-places error", e);
    return new Response(
      JSON.stringify({ error: String(e instanceof Error ? e.message : e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
