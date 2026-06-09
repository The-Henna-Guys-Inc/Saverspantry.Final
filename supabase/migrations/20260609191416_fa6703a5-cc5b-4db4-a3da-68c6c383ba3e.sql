ALTER TABLE public.flyer_sources
  ADD COLUMN IF NOT EXISTS flyer_landing_url text,
  ADD COLUMN IF NOT EXISTS last_resolved_url text,
  ADD COLUMN IF NOT EXISTS last_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS requires_week_select boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS week_selector_css text,
  ADD COLUMN IF NOT EXISTS week_selector_strategy text,
  ADD COLUMN IF NOT EXISTS selector_learned_at timestamptz;

ALTER TABLE public.flyer_sources
  DROP CONSTRAINT IF EXISTS flyer_sources_week_selector_strategy_check;
ALTER TABLE public.flyer_sources
  ADD CONSTRAINT flyer_sources_week_selector_strategy_check
  CHECK (week_selector_strategy IS NULL OR week_selector_strategy IN ('click','select'));