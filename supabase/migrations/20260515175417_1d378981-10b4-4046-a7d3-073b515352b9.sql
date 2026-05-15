
CREATE TABLE public.city_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT,
  source TEXT NOT NULL DEFAULT 'deals_page',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.city_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join waitlist"
  ON public.city_waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins view waitlist"
  ON public.city_waitlist FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_city_waitlist_created_at ON public.city_waitlist (created_at DESC);
CREATE INDEX idx_city_waitlist_city_state ON public.city_waitlist (state, city);
