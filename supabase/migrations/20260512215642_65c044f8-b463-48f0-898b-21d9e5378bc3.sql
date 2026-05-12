
-- promo_email_ingestions: one row per inbound email
CREATE TABLE public.promo_email_ingestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_address TEXT NOT NULL,
  from_domain TEXT NOT NULL,
  to_address TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_storage_path TEXT,
  body_text_excerpt TEXT,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  matched_store_id UUID REFERENCES public.specialty_stores(id) ON DELETE SET NULL,
  match_confidence TEXT NOT NULL DEFAULT 'unmatched',
  match_method TEXT,
  detected_zip TEXT,
  detected_address TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_promo_email_ingestions_status ON public.promo_email_ingestions (status, received_at DESC);
CREATE INDEX idx_promo_email_ingestions_received ON public.promo_email_ingestions (received_at DESC);
CREATE INDEX idx_promo_email_ingestions_from_domain ON public.promo_email_ingestions (from_domain);

ALTER TABLE public.promo_email_ingestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view promo email ingestions"
  ON public.promo_email_ingestions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert promo email ingestions"
  ON public.promo_email_ingestions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update promo email ingestions"
  ON public.promo_email_ingestions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete promo email ingestions"
  ON public.promo_email_ingestions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_promo_email_ingestions_updated_at
  BEFORE UPDATE ON public.promo_email_ingestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- store_email_aliases: map a from_domain or from_address to a store chain or specific store
CREATE TABLE public.store_email_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_type TEXT NOT NULL,
  match_value TEXT NOT NULL,
  chain_name TEXT,
  store_id UUID REFERENCES public.specialty_stores(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_type, match_value)
);

CREATE INDEX idx_store_email_aliases_value ON public.store_email_aliases (match_value);

ALTER TABLE public.store_email_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view store email aliases"
  ON public.store_email_aliases FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert store email aliases"
  ON public.store_email_aliases FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = created_by);

CREATE POLICY "Admins update store email aliases"
  ON public.store_email_aliases FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete store email aliases"
  ON public.store_email_aliases FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_store_email_aliases_updated_at
  BEFORE UPDATE ON public.store_email_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link flyer batches back to source email
ALTER TABLE public.flyer_extraction_batches
  ADD COLUMN source_email_id UUID REFERENCES public.promo_email_ingestions(id) ON DELETE SET NULL;

CREATE INDEX idx_flyer_batches_source_email ON public.flyer_extraction_batches (source_email_id);

-- Storage bucket for raw emails + attachments (private, admin only)
INSERT INTO storage.buckets (id, name, public)
VALUES ('promo-emails', 'promo-emails', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read promo emails"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'promo-emails' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins upload promo emails"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'promo-emails' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete promo emails"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'promo-emails' AND has_role(auth.uid(), 'admin'::app_role));
