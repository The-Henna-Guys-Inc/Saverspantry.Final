import { supabase } from "@/integrations/supabase/client";
import { CUISINE_STAPLES, DEFAULT_WATCH_MIN_PCT } from "@/lib/cuisineStaples";

/**
 * Insert any missing top-5 staples for the user's cuisines into watchlist_items.
 * Idempotent: existing food_names are skipped. Returns the count inserted.
 */
export async function syncWatchlistStaples(userId: string, cuisines: string[]): Promise<number> {
  if (!userId) return 0;

  // Staples wanted for the user's currently-selected cuisines
  const wanted = new Set<string>();
  for (const c of cuisines ?? []) {
    const staples = CUISINE_STAPLES[c.toLowerCase()];
    if (staples) staples.forEach((s) => wanted.add(s.toLowerCase()));
  }

  // All known staples across every cuisine (used to detect previously-seeded items)
  const allKnownStaples = new Set<string>();
  for (const list of Object.values(CUISINE_STAPLES)) {
    list.forEach((s) => allKnownStaples.add(s.toLowerCase()));
  }

  const { data: existingRows } = await supabase
    .from("watchlist_items")
    .select("id, food_name")
    .eq("user_id", userId);
  const existing = (existingRows ?? []).map((r: any) => ({
    id: r.id as string,
    name: (r.food_name ?? "").toLowerCase(),
  }));
  const existingNames = new Set(existing.map((r) => r.name));

  // Remove staples that belong to cuisines the user no longer has selected.
  // Only deletes items that are part of our curated staples list — user-added
  // custom items are preserved.
  const staleIds = existing
    .filter((r) => allKnownStaples.has(r.name) && !wanted.has(r.name))
    .map((r) => r.id);
  if (staleIds.length) {
    const { error: delErr } = await supabase
      .from("watchlist_items")
      .delete()
      .in("id", staleIds);
    if (delErr) console.error("syncWatchlistStaples delete failed", delErr);
  }

  // Insert any missing staples for the current cuisines
  const toInsert = Array.from(wanted)
    .filter((s) => !existingNames.has(s))
    .map((food_name) => ({ user_id: userId, food_name, min_savings_pct: DEFAULT_WATCH_MIN_PCT }));

  if (!toInsert.length) return 0;
  const { error } = await supabase.from("watchlist_items").insert(toInsert);
  if (error) {
    console.error("syncWatchlistStaples failed", error);
    return 0;
  }
  return toInsert.length;
}
