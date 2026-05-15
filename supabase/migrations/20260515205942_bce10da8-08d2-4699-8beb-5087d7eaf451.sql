
-- Monthly USDA food plan cost data
CREATE TABLE public.usda_food_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month date NOT NULL,
  plan text NOT NULL CHECK (plan IN ('thrifty','low_cost','moderate_cost','liberal')),
  household_type text NOT NULL,
  age_min int,
  age_max int,
  sex text,
  weekly_cost_usd numeric(10,2),
  monthly_cost_usd numeric(10,2) NOT NULL,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_month, plan, household_type)
);

CREATE INDEX idx_usda_food_plans_month ON public.usda_food_plans (report_month DESC);
CREATE INDEX idx_usda_food_plans_lookup ON public.usda_food_plans (plan, household_type, report_month DESC);

ALTER TABLE public.usda_food_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "USDA food plans are publicly readable"
  ON public.usda_food_plans FOR SELECT USING (true);

CREATE POLICY "Admins manage USDA food plans"
  ON public.usda_food_plans FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Sync log
CREATE TABLE public.usda_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('success','no_change','error','partial')),
  report_month date,
  rows_imported int DEFAULT 0,
  source_url text,
  error_message text,
  triggered_by text DEFAULT 'cron'
);

CREATE INDEX idx_usda_sync_log_ran_at ON public.usda_sync_log (ran_at DESC);

ALTER TABLE public.usda_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read USDA sync log"
  ON public.usda_sync_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert USDA sync log"
  ON public.usda_sync_log FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
