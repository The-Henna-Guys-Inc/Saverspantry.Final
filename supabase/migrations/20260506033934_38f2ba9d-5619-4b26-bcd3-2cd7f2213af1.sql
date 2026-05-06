
-- Catalog of specialty grocery stores
CREATE TABLE public.specialty_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  cuisine_specialties TEXT[] NOT NULL DEFAULT '{}',
  chain_name TEXT,
  price_tier TEXT NOT NULL DEFAULT 'unknown',
  description TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  country TEXT DEFAULT 'US',
  latitude NUMERIC,
  longitude NUMERIC,
  google_rating NUMERIC,
  google_rating_count INT,
  last_synced_at TIMESTAMPTZ,
  curation_source TEXT NOT NULL DEFAULT 'admin_curated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_specialty_stores_cuisines ON public.specialty_stores USING GIN (cuisine_specialties);
CREATE INDEX idx_specialty_stores_latlng ON public.specialty_stores (latitude, longitude);

ALTER TABLE public.specialty_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view stores"
  ON public.specialty_stores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can submit stores"
  ON public.specialty_stores FOR INSERT TO authenticated
  WITH CHECK (curation_source = 'user_submitted');

CREATE TRIGGER trg_specialty_stores_updated
  BEFORE UPDATE ON public.specialty_stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User store visits ("I shop here")
CREATE TABLE public.store_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES public.specialty_stores(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_rating INT CHECK (user_rating BETWEEN 1 AND 5),
  user_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id)
);

CREATE INDEX idx_store_visits_user ON public.store_visits (user_id, visited_at DESC);

ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own store_visits"
  ON public.store_visits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own store_visits"
  ON public.store_visits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own store_visits"
  ON public.store_visits FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own store_visits"
  ON public.store_visits FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS search_radius_miles INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS show_specialty_stores BOOLEAN NOT NULL DEFAULT true;
