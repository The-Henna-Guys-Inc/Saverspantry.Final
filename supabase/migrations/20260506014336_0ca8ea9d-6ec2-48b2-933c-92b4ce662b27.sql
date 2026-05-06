
CREATE TABLE public.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  household_id uuid,
  week_start_date date NOT NULL,
  plan jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own meal_plans" ON public.meal_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own meal_plans" ON public.meal_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own meal_plans" ON public.meal_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own meal_plans" ON public.meal_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_meal_plans_updated_at
BEFORE UPDATE ON public.meal_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
