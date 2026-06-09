## Option B build: curated flyer sources + better moderation filters

### 1. New table: `flyer_sources`
A small admin-managed registry of chain flyer URLs to scrape on a schedule.

Columns:
- `chain_name`, `store_name` (optional, for single-store sources)
- `region`, `city` (target launch area; matches existing `LAUNCH_CITIES`)
- `flyer_url` (templated URL, e.g. `https://www.jewelosco.com/weeklyad/...`)
- `render_mode` (`html` | `firecrawl` — picks fetcher in `import-flyer-from-url`)
- `default_store_id` (optional FK to `specialty_stores` so auto-import skips the confirm dialog when the chain maps to a known store)
- `cadence` (`weekly` for now; placeholder for daily later)
- `active`, `last_run_at`, `last_status`, `last_error`, `consecutive_failures`

Admin-only RLS; service_role full access for the cron function.

### 2. Edge function: `discover-flyer-sources`
- Triggered by `pg_cron` weekly (Wed 6am Central) and on-demand by admin "Run now" button.
- Loads active sources, optionally filtered by `region` / `city` / `source_id`.
- Hard cap per run: max 30 sources (and skips any scraped in the last 5 days) — protects Firecrawl credits.
- For each source: invokes existing `import-flyer-from-url` (which already handles HTML + Firecrawl fallback + extraction + queueing for moderation).
- Updates `last_run_at` / `last_status`. Three consecutive failures → auto-deactivate + write to `operational_alerts`.

### 3. Admin UI: `/admin/flyer-sources`
Simple list + add/edit dialog:
- Add chain → name, region, city, URL, render mode, optional default store
- Toggle active, "Run now" button per row, last run timestamp + status badge
- "Run all active" button at top
- Seeded with: Jewel-Osco, Mariano's, Aldi, Meijer, Tony's Fresh Market, Cermak Fresh Market, Pete's Fresh Market, County Market, Schnucks, Strack & Van Til (chosen for Chicagoland / Peoria / Bloomington / Champaign coverage).

### 4. Moderation queue filters (`AdminDeals.tsx`)
Add a filter bar above the deal list (works in both default and `?batch=` modes):
- **Store** — searchable dropdown of distinct `store_name` in the current result set
- **City** — dropdown of distinct `city`
- **Item search** — text input over `food_name` / `title` (ILIKE)
- **Source** — chips: All / Flyer batches / Email / User-submitted
- **Sort** — Newest first (default) / Oldest / Highest savings %
- **"Newly extracted" quick chip** — last 24h + `source = admin_curated` + has `extraction_batch_id`

Filters applied server-side where cheap (source, sort, item search, store_id) and client-side for the small distinct-value dropdowns.

### Technical notes
- Cron uses `supabase--insert` (not migration) since it embeds project URL + anon key.
- `import-flyer-from-url` already populates `flyer_extraction_batches` and `extracted_store_hint`, so cron-imported flyers flow through the existing confirm dialog when no `default_store_id` is set.
- No new AI cost beyond what flyer extraction already costs; Firecrawl only used when the chain's `render_mode = firecrawl` or HTML fetch returns <300 chars.
- Filters are pure presentation on top of the existing `sale_observations` query — no schema changes for the moderation side.

### Out of scope (deferred)
- Firecrawl `search` discovery (Option A) — revisit once curated sources are stable.
- Daily cadence and per-source schedules.
- Auto-approval of high-confidence deals.
