ALTER TABLE public.sale_observations
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS google_maps_url text;