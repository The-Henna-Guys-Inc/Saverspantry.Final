
ALTER TABLE public.flyer_extraction_batches
  ALTER COLUMN store_id DROP NOT NULL;

ALTER TABLE public.flyer_extraction_batches
  ADD COLUMN IF NOT EXISTS pending_deals JSONB,
  ADD COLUMN IF NOT EXISTS extracted_store_hint JSONB,
  ADD COLUMN IF NOT EXISTS store_match_candidates JSONB,
  ADD COLUMN IF NOT EXISTS store_match_confidence TEXT,
  ADD COLUMN IF NOT EXISTS extracted_valid_from DATE,
  ADD COLUMN IF NOT EXISTS extracted_valid_until DATE,
  ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
