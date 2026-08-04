# Deals Feature Flag (v1.0 launch)

## Why

For the v1.0 App Store submission, the Deals feature is hidden behind a
feature flag. Deal coverage is still being built out nationwide, and Apple
rejects apps that ship visible "coming soon" surfaces. Nothing was deleted —
all deals code, routes, database tables, and edge functions remain intact.

## The flag

`src/lib/featureFlags.ts`

```ts
export const DEALS_FEATURE_ENABLED = false;
```

## How to re-enable for v1.1

1. Set `DEALS_FEATURE_ENABLED = true` in `src/lib/featureFlags.ts`.
2. Rebuild the web app and run `npx cap sync ios`.
3. Archive in Xcode and resubmit to App Store Connect.

No database, edge function, or schema changes are required.

## Preservation branch

A snapshot of the fully-working deals implementation lives on the branch
`deals-v1-preserved` in the project's GitHub repository (created from `main`
before the flag work landed).

## What the flag gates

| Surface | File | Behavior when `false` |
| --- | --- | --- |
| Bottom nav Deals tab | `src/components/MobileTabBar.tsx` | Tab hidden, grid collapses 6 → 5 columns |
| `/deals`, `/sales`, `/stores`, `/watchlist` routes | `src/App.tsx` | Redirect to `/` |
| Home watchlist/deals card | `src/components/HomeAuthed.tsx` | Card not rendered |
| Welcome hero + perks copy | `src/pages/Welcome.tsx` | Swap-engine copy (`HERO_NO_DEALS`, `PERKS_NO_DEALS`) |
| Favorite stores manager + copy | `src/pages/Settings.tsx` | Hidden / deals wording removed |
| Dashboard Watchlist tab | `src/pages/Dashboard.tsx` | Tab and content hidden |

## Deliberately NOT gated

- Admin pages: `/admin/deals`, `/admin/flyer-sources`, `/admin/email-inbox`.
  Internal curation continues during v1.0.
- All Supabase tables (`sales`, `stores`, `service_areas`, `city_waitlist`,
  `flyer_sources`, `watchlist_items`, …).
- All edge functions (flyer discovery, URL resolution, deal extraction, cron).
- MCP tools (`search_deals`, `list_watchlist`, `list_favorite_stores`) — these
  are agent-facing, not user-facing UI.

## Gotchas when re-enabling

- `WaitlistDialog` and `UserSubmitDealDialog` are still in the codebase; the
  waitlist dialog is currently unreferenced from any live screen — re-wire it
  where you want it in v1.1.
- Welcome copy: restore by flipping the flag; the original strings are kept in
  `HERO_WITH_DEALS` / `PERKS_WITH_DEALS` constants.
- `favorite_store_ids` / `favorites_filter_enabled` on `profiles` keep their
  values while the flag is off, so returning users get their favorites back.
- Legacy `DEALS_LAUNCHED` / `DEALS_LAUNCH_DATE` flags remain in the file for
  compatibility; they are not used to gate UI anymore.
