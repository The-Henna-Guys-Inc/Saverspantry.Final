CREATE TABLE public.pantry_consumption_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  household_id UUID,
  pantry_item_id UUID,
  item_name TEXT NOT NULL,
  quantity_used NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  expires_on DATE,
  was_before_expiry BOOLEAN,
  days_to_expiry INTEGER,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pantry_consumption_user_time ON public.pantry_consumption_log (user_id, used_at DESC);

ALTER TABLE public.pantry_consumption_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pantry_consumption_log" ON public.pantry_consumption_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pantry_consumption_log" ON public.pantry_consumption_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own pantry_consumption_log" ON public.pantry_consumption_log
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all pantry_consumption_log" ON public.pantry_consumption_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));