CREATE TABLE public.places_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuisine TEXT NOT NULL,
  geo_cell TEXT NOT NULL,
  radius_miles INTEGER NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  searched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (cuisine, geo_cell, radius_miles)
);

CREATE INDEX idx_places_cache_lookup ON public.places_search_cache (cuisine, geo_cell, radius_miles, searched_at DESC);

ALTER TABLE public.places_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view places cache"
  ON public.places_search_cache FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage places cache"
  ON public.places_search_cache FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));