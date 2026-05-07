ALTER TABLE public.pantry_items
  ADD COLUMN IF NOT EXISTS low_stock_threshold numeric;

CREATE TABLE IF NOT EXISTS public.pantry_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.pantry_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pantry_locations" ON public.pantry_locations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pantry_locations" ON public.pantry_locations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pantry_locations" ON public.pantry_locations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own pantry_locations" ON public.pantry_locations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);