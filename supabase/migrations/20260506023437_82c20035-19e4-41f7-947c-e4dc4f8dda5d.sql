CREATE TABLE public.pantry_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  household_id UUID,
  item TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unit',
  category TEXT,
  expires_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pantry_items" ON public.pantry_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pantry_items" ON public.pantry_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pantry_items" ON public.pantry_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own pantry_items" ON public.pantry_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_pantry_items_updated_at
BEFORE UPDATE ON public.pantry_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pantry_items_user ON public.pantry_items(user_id);