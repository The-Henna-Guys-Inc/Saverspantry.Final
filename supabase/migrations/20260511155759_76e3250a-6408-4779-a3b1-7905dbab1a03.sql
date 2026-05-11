CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.known_google_places (
  google_place_id TEXT PRIMARY KEY,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.known_google_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view known_google_places"
  ON public.known_google_places FOR SELECT TO authenticated USING (true);