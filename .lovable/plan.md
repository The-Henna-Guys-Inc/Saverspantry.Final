## v1.5 — Cuisine personalization + Bulk-Buy engine

This slice does two things at once because they share the same spine: a per-user **cuisine profile** that filters every discovery surface (Pantry, Stores, Sales) and feeds a new **data-driven Bulk-Buy** recommender that replaces today's static curated UI.

### 1. Cuisine profile (the spine)

- Add `profiles.cuisine_preferences text[]` (e.g. `['korean','south_asian','mexican']`) and `profiles.cuisine_filter_enabled bool default true`.
- Settings page gets a "My cuisines" multi-select using the existing `CuisineTag` list from `src/lib/cuisineHints.ts`.
- New tiny hook `useCuisinePrefs()` — reads/writes profile, exposed app-wide.
- New shared `<CuisineFilterBar />` component that shows the active cuisines as chips with a single **"Show everything"** toggle. Drops on Pantry / Stores / Sales / Bulk-Buy.
- Auto-bootstrap: first time a user lands with no cuisines set, infer from their pantry + saved recipes (run `detectItemCuisines` over recent items, take top 3) and seed the profile. They can override anytime.

### 2. Pantry — cuisine-aware

- Pantry list gets a small "Cuisines" column/chip per item (computed via `detectItemCuisines`).
- When filter is on: show items whose cuisine matches the user's preferences first, others collapsed under a "Other items (N)" expand.
- The existing **SpecialtyStoreBanner** already uses topCuisines — wire it so when the user has explicit prefs, those win over inferred ones.

### 3. Stores — cuisine-aware default

- `/stores` defaults active filter chips to the user's cuisine prefs (instead of empty).
- Header shows "Showing stores for Korean / South Asian — [Show all stores]".
- Empty state copy adjusts: "No Korean / South Asian stores nearby — [Show all stores]".

### 4. Sales — cuisine-aware default

- `/sales` filters `sale_observations` to ones whose `food_name` maps (via `detectItemCuisines`) to the user's cuisines, OR generic staples (no cuisine tag) — those always show because rice/milk/eggs aren't ethnic.
- Same "Show everything" toggle in the header.

### 5. Bulk-Buy engine (data-driven, replaces static UI)

Replaces `BulkStoragePlanner` with a real recommender driven by what the user actually buys + cuisine.

**New table `bulk_buy_candidates`** — pre-computed nightly:
- `food_name`, `cuisine_tags text[]`, `typical_unit_price_usd`, `bulk_unit_price_usd`, `bulk_pack_size`, `est_savings_pct`, `shelf_life_days`, `storage_tip`, `best_store_type` (e.g. "south_asian_grocer"), `confidence` (low/med/high), `source` (`derived` | `curated`).

**Edge function `bulk-buy-recommend`** (called from new `/bulk-buy` page):
- Inputs: user's cuisine prefs, household_size, pantry consumption frequency from `pantry_consumption_log`.
- Logic:
  1. Pull `bulk_buy_candidates` matching cuisine prefs.
  2. Cross-reference with the user's `pantry_consumption_log` — items they actually use frequently get boosted score.
  3. Cross-reference active `sale_observations` — if any candidate is currently on sale, surface it at top with "On sale now" badge.
  4. Compute personalized `est_monthly_savings_usd` from consumption rate × savings_pct.
  5. Return ranked list with reasoning.

**New page `/bulk-buy`** (replaces the BulkStoragePlanner widget on Pantry — link out to it):
- Hero shows total potential monthly savings.
- Cards per recommendation: food, pack size, bulk vs typical price, where to buy (links to specialty stores nearby with that cuisine tag), shelf life, storage tip, current sale flag.
- Filter bar at top — same cuisine bar as everywhere else.
- "Add to grocery list" + "Add to watchlist" actions per card.

**Seed `bulk_buy_candidates`** with ~40 curated entries covering all 10 cuisines (rice in 20lb bags, lentils, gochujang tubs, masa, etc.) so the page has content immediately. Nightly cron `bulk-buy-rebuild` (deferred — schema-ready but not wired this slice) will later derive new candidates from sale/price observations.

### 6. Pantry page cleanup

- Remove the inline `BulkStoragePlanner` card; replace with a compact "Bulk-buy savings → $X/mo potential" link card pointing to `/bulk-buy`.

### Order of operations within this slice

1. Migration: profile columns + `bulk_buy_candidates` table + RLS + seed data.
2. `useCuisinePrefs` hook + `<CuisineFilterBar />` + Settings UI.
3. Wire filter into Pantry, Stores, Sales (smallest changes first).
4. `bulk-buy-recommend` edge fn + `/bulk-buy` page.
5. Replace BulkStoragePlanner card on Pantry with the new link card.

### Why this order

The cuisine profile is the dependency for everything else. Without it, the Bulk-Buy engine has no signal beyond raw consumption, and the Pantry/Stores/Sales filters are guesses. Built first, every later screen just reads from it.

Approve and I'll start with step 1 (migration).