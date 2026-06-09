
CREATE TABLE public.flyer_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_name TEXT NOT NULL,
  store_name TEXT,
  region TEXT,
  city TEXT,
  flyer_url TEXT NOT NULL,
  render_mode TEXT NOT NULL DEFAULT 'html' CHECK (render_mode IN ('html','firecrawl')),
  default_store_id UUID REFERENCES public.specialty_stores(id) ON DELETE SET NULL,
  cadence TEXT NOT NULL DEFAULT 'weekly',
  active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  last_batch_id UUID,
  consecutive_failures INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flyer_sources TO authenticated;
GRANT ALL ON public.flyer_sources TO service_role;

ALTER TABLE public.flyer_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage flyer sources" ON public.flyer_sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_flyer_sources_active_lastrun ON public.flyer_sources(active, last_run_at);

CREATE TRIGGER trg_flyer_sources_updated
  BEFORE UPDATE ON public.flyer_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
