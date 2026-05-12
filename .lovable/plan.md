# Promo email → deals pipeline

Goal: an inbox the app owns. Promo emails land there, the app pulls flyers + addresses out of them, and they show up in your existing moderation queue as `pending_review` deals tied to the right store.

Build it in three slices. Slice 1 is the foundation we'll wire up first; slices 2–3 layer on after you've seen it work end-to-end.

---

## Slice 1 — Inbox + admin review (attachments only)

**Inbound provider:** Resend Inbound (cleanest fit; same vendor for sending, available as a Lovable connector). One forwarding address: `deals@<your-domain>`.

**Flow**

```text
Promo email
   │
   ▼
Resend Inbound webhook ──► ingest-promo-email (edge fn)
                              │  • verify signature
                              │  • save raw email + attachments to storage
                              │  • parse sender, subject, body, ZIP/address
                              │  • try to match a store
                              │  • for each PDF/image attachment:
                              │       create flyer_extraction_batch
                              │       invoke extract-flyer-deals
                              ▼
                       promo_email_ingestions row
                              │
                              ▼
                Admin "Email inbox" tab on /admin/deals
                  - shows email + matched store
                  - admin can re-assign store
                  - jumps into the existing batch review screen
```

**New schema**

- `promo_email_ingestions`
  - `from_address`, `from_domain`, `subject`, `received_at`
  - `raw_storage_path` (full .eml in storage)
  - `matched_store_id` (nullable), `match_confidence` (`high` / `low` / `unmatched`)
  - `status`: `received` → `processed` → `failed` / `needs_assignment`
  - `notes`, `attachment_count`
- `flyer_extraction_batches.source_email_id` → nullable FK to the row above
- `store_email_aliases` (admin-managed): `from_domain` or `from_address` → `chain_name` or specific `store_id`. Lets you teach the system: "anything from `weeklyad@kroger.com` is Kroger."

**New storage bucket**

- `promo-emails` (private). Path: `{ingestion_id}/raw.eml` + `{ingestion_id}/attachments/<n>.pdf`.

**Admin UI additions** (no end-user UI yet)

- New tab on `/admin/deals` → **Email inbox**
  - Table: received_at · from · subject · matched store (badge: matched / low confidence / unmatched) · # deals extracted · status
  - Row click → side panel:
    - Email preview (subject, from, body excerpt, attachment list)
    - Store picker (searchable, same component used in `AdminFlyerUpload`)
    - "Reprocess" button (re-runs extraction with the corrected store)
    - "Open batch" → existing `?batch=` review flow
- New screen `/admin/email-aliases` — simple CRUD for `store_email_aliases`

**Edge function: `ingest-promo-email`**

- Accepts Resend's webhook payload
- Verifies `Resend-Signature` HMAC
- Writes raw email, then iterates attachments; only PDFs/JPEGs/PNGs/WEBPs ≤20MB
- Store matching order:
  1. Exact match in `store_email_aliases`
  2. ZIP code regex in body → if alias chain set, narrow to that chain in that ZIP
  3. Address line regex → geocode (Google Places, key already in secrets) → nearest active store within 5 mi
  4. Otherwise mark `unmatched`, status `needs_assignment`, skip extraction
- For each valid attachment: insert `flyer_extraction_batches` (linked to ingestion + matched store) and invoke `extract-flyer-deals`
- Write summary back to `promo_email_ingestions`

---

## Slice 2 — Follow "view in browser" links

Most chains don't attach the flyer; they link to it. After Slice 1 is solid:

- In `ingest-promo-email`, scan the HTML body for `<a>` tags whose text/href looks like a flyer (`weekly ad`, `view flyer`, `.pdf`, known viewer hosts like `flippapp.com`, `circular.com`, etc.)
- For direct PDF/image URLs → download and feed into the same pipeline
- For JS-heavy viewers → call the Firecrawl connector to render the page and pull the flyer asset
- Add a "Skip" filter via the AI prompt: if a flyer page yields zero priced items, mark the batch `skipped` instead of polluting the queue

## Slice 3 — User-facing forwarding + opt-in

Once admin ingestion is reliable:

- Surface a per-user forwarding alias (`deals+u_<userId>@…`) so a user's forwarded emails are credited to them and only their nearby stores are considered
- Optional: opt-in toggle in Settings → "Forward your store emails to Saver's Pantry"
- Notification when a forwarded email produces deals matching the user's watchlist (reuses `watchlist-sale-matcher`)

---

## Honest constraints to flag

- Store newsletters are tied to the subscriber's loyalty account + ZIP; we **cannot** sign one shared inbox up for every region. Realistic sources are (a) admins subscribing per-region, (b) users forwarding their own emails (Slice 3).
- JS-only ad viewers (Flipp, etc.) need Firecrawl — that's why it's deferred to Slice 2.
- Promotional email = noisy. We rely on the AI extractor's existing "skip non-grocery" guard plus a hard floor: if `extracted_items_count = 0`, mark the batch `skipped` so admins don't see empty noise.

---

## Technical details (for reference)

- **Provider auth:** Resend connector via `standard_connectors--connect`. Webhook URL is the deployed `ingest-promo-email` edge function. Signature verified with HMAC-SHA256 against a shared secret stored as `RESEND_WEBHOOK_SECRET`.
- **`extract_flyer_deals` reuse:** unchanged. We just create batches with `source_email_id` set; existing review UI works as-is.
- **RLS:** `promo_email_ingestions` and `store_email_aliases` are admin-only (same pattern as `flyer_extraction_batches`).
- **Mobile:** admin screens only — desktop-first is fine, but the side-panel uses Sheet so it stacks on 360px.

---

## What I need from you to start Slice 1

1. **Confirm Resend** as the inbound provider (vs. Mailgun / SendGrid).
2. **Forwarding address** — what local part? (`deals@`, `flyers@`, `inbox@`?)
3. **Confirm scope:** Slice 1 only for now (attachments + admin inbox), no link-following or user-facing pieces yet.

Once you confirm those three, I'll: connect Resend → add the schema + bucket → build the edge function → add the Email inbox tab and alias screen.
