import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPantryItems from "./tools/list-pantry-items";
import addPantryItem from "./tools/add-pantry-item";
import listFavoriteStores from "./tools/list-favorite-stores";
import searchDeals from "./tools/search-deals";
import listWatchlist from "./tools/list-watchlist";
import { DEALS_FEATURE_ENABLED } from "@/lib/featureFlags";

// Build the OAuth issuer from the Supabase project ref. Vite inlines this env
// var as a literal at build time, so the entry stays import-safe (no runtime
// env read at module load). The fallback keeps the URL well-formed during the
// throwaway manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "saverspantry-mcp",
  title: "Saver's Pantry",
  version: "0.1.0",
  instructions:
    DEALS_FEATURE_ENABLED
      ? "Tools for Saver's Pantry — read and update the signed-in user's pantry, favorite stores, watchlist, and search current grocery deals. All data is scoped to the authenticated user."
      : "Tools for Saver's Pantry — read and update the signed-in user's pantry. All data is scoped to the authenticated user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  // v1.1: deals/stores tools return when DEALS_FEATURE_ENABLED is true.
  tools: DEALS_FEATURE_ENABLED
    ? [listPantryItems, addPantryItem, listFavoriteStores, searchDeals, listWatchlist]
    : [listPantryItems, addPantryItem],
});
