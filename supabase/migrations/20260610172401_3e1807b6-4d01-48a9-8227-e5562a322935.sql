
ALTER TABLE public.flyer_sources
  ADD COLUMN IF NOT EXISTS store_zip text,
  ADD COLUMN IF NOT EXISTS store_picker_strategy text,
  ADD COLUMN IF NOT EXISTS store_picker_input_css text,
  ADD COLUMN IF NOT EXISTS store_picker_submit_css text,
  ADD COLUMN IF NOT EXISTS store_picker_learned_at timestamptz;

ALTER TABLE public.flyer_sources
  DROP CONSTRAINT IF EXISTS flyer_sources_store_picker_strategy_check;

ALTER TABLE public.flyer_sources
  ADD CONSTRAINT flyer_sources_store_picker_strategy_check
  CHECK (store_picker_strategy IS NULL OR store_picker_strategy IN ('zip','storeid','none'));
