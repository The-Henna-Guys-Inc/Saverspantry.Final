import { supabase } from "@/integrations/supabase/client";
import { CUISINE_STAPLES, DEFAULT_WATCH_MIN_PCT } from "@/lib/cuisineStaples";

/**
 * Insert any missing top-5 staples for the user's cuisines into watchlist_items.
 * Idempotent: existing food_names are skipped. Returns the count inserted.
 */
export async function syncWatchlistStaples(userId: string, cuisines: string[]): Promise<number> {
  if (!userId || !cuisines?.length) return 0;

  const wanted = new Set<string>();
  for (const c of cuisines) {
    const staples = CUISINE_STAPLES[c.toLowerCase()];
    if (staples) staples.forEach((s) => wanted.add(s));
  }
  if (wanted.size === 0) return 0;

  const { data: existingRows } = await supabase
    .from("watchlist_items")
    .select("food_name")
    .eq("user_id", userId);
  const existing = new Set((existingRows ?? []).map((r: any) => (r.food_name ?? "").toLowerCase()));

  const toInsert = Array.from(wanted)
    .filter((s) => !existing.has(s))
    .map((food_name) => ({ user_id: userId, food_name, min_savings_pct: DEFAULT_WATCH_MIN_PCT }));

  if (!toInsert.length) return 0;
  const { error } = await supabase.from("watchlist_items").insert(toInsert);
  if (error) {
    console.error("syncWatchlistStaples failed", error);
    return 0;
  }
  return toInsert.length;
}
