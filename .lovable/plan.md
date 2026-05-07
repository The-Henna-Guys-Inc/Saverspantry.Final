## Plan: Analytics, reports & background jobs

You picked a lot — that's good, but shipping it all in one go would create a fragile mess. I'll deliver in 4 slices, each independently useful and testable.

### Slice 1 — Foundation + Savings Dashboard *(building now)*
- New table `savings_events` — every time a swap is saved, a meal plan is generated, or a sale alert is captured, we log a row with `category`, `amount_usd`, `metadata`. This becomes the spine of every chart later.
- New table `analytics_snapshots` — pre-aggregated weekly totals (savings, plans, alerts). Cron writes here so dashboards load instantly.
- New page `/dashboard` — your personal savings dashboard:
  - Total saved (lifetime + this month)
  - Trend chart (last 12 weeks)
  - Breakdown by source (swaps / sales / meal-plan budgeting)
  - Top categories
- Backfill: a one-time migration populates `savings_events` from existing `saved_swaps`.

### Slice 2 — Pantry insights + Meal-plan/spend report
- `/dashboard` gets two more tabs:
  - **Pantry**: items expiring this week, waste avoided ($ from items used before expiry), most-restocked, low-stock summary.
  - **Spend**: weekly grocery cost vs. budget, cost-per-meal, cost-per-person, plan adherence (did you actually generate a list each week).
- New table `pantry_consumption_log` to track deductions for the waste-avoided math.

### Slice 3 — Watchlist & sales activity + Admin global view
- Watchlist tab on `/dashboard`: alerts triggered, deals captured, top stores, biggest price drops.
- New `/admin/analytics` page (gated by existing `has_role('admin')`): aggregated, anonymized stats — DAU/WAU, swaps run, savings generated platform-wide, top foods, top stores. No PII.

### Slice 4 — Exports + scheduled jobs
- **CSV exports**: edge function `export-analytics` streams CSVs (savings log, pantry history, grocery spend) → "Download" buttons on dashboard.
- **PDF monthly recap**: edge function `monthly-recap-pdf` generates a personal PDF (totals, top wins, savings chart). Surfaced on dashboard + emailable later.
- **Cron jobs** (pg_cron + pg_net):
  - Daily 8am UTC → `pantry-expiry-check` edge fn (low-stock + expiring-soon notifications, written to a `notifications` table for in-app display).
  - Sunday 11pm UTC → `weekly-savings-rollup` edge fn (writes `analytics_snapshots`).
  - Every 30 min → `watchlist-sale-matcher` edge fn (matches new `sale_observations` against `watchlist_items`, writes notifications).

### Technical details
- All new tables get RLS: `user_id = auth.uid()` for personal data; admin-readable via `has_role`.
- Aggregations done server-side via SQL views or pre-rolled snapshots — never pull all rows to the client.
- Charts use `recharts` (already in shadcn/ui).
- Notifications: simple `notifications` table (Slice 4) — bell icon in header, no push/email yet.
- All edge functions follow existing pattern: CORS headers, Lovable AI gateway only when AI is needed (most of these are pure data).
- Backfill of `savings_events` from `saved_swaps` runs as part of Slice 1 migration.

### Why this order
Slice 1 establishes the data spine — every later slice writes to or reads from `savings_events` / `analytics_snapshots`. Building the admin view or PDFs first would mean rewriting them once the spine exists.

I'll start Slice 1 once you approve.