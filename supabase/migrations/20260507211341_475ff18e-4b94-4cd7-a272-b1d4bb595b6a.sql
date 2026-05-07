-- Savings events: spine for all analytics
CREATE TABLE public.savings_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  household_id UUID,
  category TEXT NOT NULL, -- 'swap' | 'sale' | 'meal_plan' | 'pantry_use'
  source_id UUID, -- optional link back to saved_swap, sale_observation, meal_plan, pantry_item
  food_name TEXT,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_savings_events_user_time ON public.savings_events (user_id, occurred_at DESC);
CREATE INDEX idx_savings_events_category ON public.savings_events (user_id, category);

ALTER TABLE public.savings_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own savings_events" ON public.savings_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own savings_events" ON public.savings_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own savings_events" ON public.savings_events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all savings_events" ON public.savings_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Pre-aggregated weekly snapshots (cron-populated; Slice 4)
CREATE TABLE public.analytics_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  total_savings_usd NUMERIC NOT NULL DEFAULT 0,
  swap_count INTEGER NOT NULL DEFAULT 0,
  sale_count INTEGER NOT NULL DEFAULT 0,
  meal_plan_count INTEGER NOT NULL DEFAULT 0,
  by_category JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX idx_analytics_snapshots_user_week ON public.analytics_snapshots (user_id, week_start DESC);

ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own analytics_snapshots" ON public.analytics_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all analytics_snapshots" ON public.analytics_snapshots
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_analytics_snapshots_updated_at
  BEFORE UPDATE ON public.analytics_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-log savings_event when a swap is saved
CREATE OR REPLACE FUNCTION public.log_swap_savings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  orig_cost NUMERIC;
  best_swap_cost NUMERIC;
  diff NUMERIC;
BEGIN
  orig_cost := COALESCE((NEW.result->'original'->>'estimated_cost_usd')::numeric, 0);
  SELECT MIN((s->>'estimated_cost_usd')::numeric) INTO best_swap_cost
    FROM jsonb_array_elements(NEW.result->'swaps') s
    WHERE (s->>'estimated_cost_usd') IS NOT NULL;
  IF orig_cost > 0 AND best_swap_cost IS NOT NULL THEN
    diff := orig_cost - best_swap_cost;
    IF diff > 0 THEN
      INSERT INTO public.savings_events (user_id, household_id, category, source_id, food_name, amount_usd, metadata, occurred_at)
      VALUES (NEW.user_id, NEW.household_id, 'swap', NEW.id, NEW.food, diff,
              jsonb_build_object('original_cost', orig_cost, 'best_swap_cost', best_swap_cost),
              NEW.created_at);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_log_swap_savings
  AFTER INSERT ON public.saved_swaps
  FOR EACH ROW EXECUTE FUNCTION public.log_swap_savings();

-- Backfill from existing saved_swaps
INSERT INTO public.savings_events (user_id, household_id, category, source_id, food_name, amount_usd, metadata, occurred_at)
SELECT
  ss.user_id,
  ss.household_id,
  'swap',
  ss.id,
  ss.food,
  (COALESCE((ss.result->'original'->>'estimated_cost_usd')::numeric, 0) -
   (SELECT MIN((s->>'estimated_cost_usd')::numeric) FROM jsonb_array_elements(ss.result->'swaps') s)),
  jsonb_build_object(
    'original_cost', COALESCE((ss.result->'original'->>'estimated_cost_usd')::numeric, 0),
    'best_swap_cost', (SELECT MIN((s->>'estimated_cost_usd')::numeric) FROM jsonb_array_elements(ss.result->'swaps') s),
    'backfilled', true
  ),
  ss.created_at
FROM public.saved_swaps ss
WHERE COALESCE((ss.result->'original'->>'estimated_cost_usd')::numeric, 0) > 0
  AND (SELECT MIN((s->>'estimated_cost_usd')::numeric) FROM jsonb_array_elements(ss.result->'swaps') s) IS NOT NULL
  AND COALESCE((ss.result->'original'->>'estimated_cost_usd')::numeric, 0) >
      (SELECT MIN((s->>'estimated_cost_usd')::numeric) FROM jsonb_array_elements(ss.result->'swaps') s);