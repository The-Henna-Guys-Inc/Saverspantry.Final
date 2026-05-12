
-- 1. specialty_stores additions
ALTER TABLE public.specialty_stores
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_specialty_stores_zip ON public.specialty_stores (zip_code);
CREATE INDEX IF NOT EXISTS idx_specialty_stores_active ON public.specialty_stores (active);

-- 2. sale_observations additions
ALTER TABLE public.sale_observations
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS source_flyer_url text,
  ADD COLUMN IF NOT EXISTS approved_by_admin_id uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_notes text,
  ADD COLUMN IF NOT EXISTS extraction_batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_sales_moderation_queue
  ON public.sale_observations (moderation_status, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_extraction_batch
  ON public.sale_observations (extraction_batch_id);

-- 3. flyer_extraction_batches
CREATE TABLE IF NOT EXISTS public.flyer_extraction_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.specialty_stores(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL,
  original_filename text NOT NULL,
  stored_file_url text NOT NULL,
  file_type text NOT NULL,
  file_hash text,
  page_count int NOT NULL DEFAULT 1,
  flyer_valid_from timestamptz,
  flyer_valid_until timestamptz,
  extraction_status text NOT NULL DEFAULT 'pending',
  extracted_items_count int NOT NULL DEFAULT 0,
  approved_items_count int NOT NULL DEFAULT 0,
  ai_cost_usd numeric NOT NULL DEFAULT 0,
  extraction_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_flyer_batches_store ON public.flyer_extraction_batches (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flyer_batches_status ON public.flyer_extraction_batches (extraction_status);
CREATE INDEX IF NOT EXISTS idx_flyer_batches_hash ON public.flyer_extraction_batches (file_hash);

ALTER TABLE public.flyer_extraction_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view flyer batches" ON public.flyer_extraction_batches
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert flyer batches" ON public.flyer_extraction_batches
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = admin_user_id);
CREATE POLICY "Admins update flyer batches" ON public.flyer_extraction_batches
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete flyer batches" ON public.flyer_extraction_batches
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. user_deal_submissions (rate limiting log)
CREATE TABLE IF NOT EXISTS public.user_deal_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_observation_id uuid REFERENCES public.sale_observations(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_user_submissions_user_time
  ON public.user_deal_submissions (user_id, submitted_at DESC);

ALTER TABLE public.user_deal_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own submissions" ON public.user_deal_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all submissions" ON public.user_deal_submissions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own submission" ON public.user_deal_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 5. Storage buckets (private)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('flyer-uploads', 'flyer-uploads', false)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('deal-submissions', 'deal-submissions', false)
  ON CONFLICT (id) DO NOTHING;

-- flyer-uploads policies (admin-only)
DROP POLICY IF EXISTS "Admins read flyer uploads" ON storage.objects;
CREATE POLICY "Admins read flyer uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'flyer-uploads' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins write flyer uploads" ON storage.objects;
CREATE POLICY "Admins write flyer uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'flyer-uploads' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update flyer uploads" ON storage.objects;
CREATE POLICY "Admins update flyer uploads" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'flyer-uploads' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete flyer uploads" ON storage.objects;
CREATE POLICY "Admins delete flyer uploads" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'flyer-uploads' AND has_role(auth.uid(), 'admin'::app_role));

-- deal-submissions policies (user owns their folder, admins read all)
DROP POLICY IF EXISTS "Users read own deal submissions" ON storage.objects;
CREATE POLICY "Users read own deal submissions" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'deal-submissions'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS "Users upload own deal submissions" ON storage.objects;
CREATE POLICY "Users upload own deal submissions" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'deal-submissions'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own deal submissions" ON storage.objects;
CREATE POLICY "Users delete own deal submissions" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'deal-submissions'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role))
  );
