
-- Watchlist: items a user wants sale alerts for
CREATE TABLE public.watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  food_name text NOT NULL,
  min_savings_pct integer NOT NULL DEFAULT 20,
  min_savings_usd numeric NOT NULL DEFAULT 1.00,
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_watchlist_user ON public.watchlist_items(user_id);
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own watchlist" ON public.watchlist_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own watchlist" ON public.watchlist_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own watchlist" ON public.watchlist_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own watchlist" ON public.watchlist_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_watchlist_updated
  BEFORE UPDATE ON public.watchlist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sale observations: sales currently active (chain-sourced or crowdsourced)
CREATE TABLE public.sale_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_name text NOT NULL,
  store_id uuid REFERENCES public.specialty_stores(id) ON DELETE SET NULL,
  store_name text NOT NULL,
  store_chain text,
  title text NOT NULL,
  sale_price_usd numeric NOT NULL,
  regular_price_usd numeric,
  savings_pct numeric,
  pack_size text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'user_submitted', -- 'kroger_api' | 'user_submitted' | 'admin_curated'
  submitted_by_user_id uuid,
  photo_url text,
  confirmation_count integer NOT NULL DEFAULT 0,
  flag_count integer NOT NULL DEFAULT 0,
  moderation_status text NOT NULL DEFAULT 'auto_approved', -- 'auto_approved' | 'pending_review' | 'approved' | 'rejected' | 'expired'
  city text,
  region text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_food ON public.sale_observations(food_name, ends_at);
CREATE INDEX idx_sales_active ON public.sale_observations(ends_at) WHERE moderation_status IN ('auto_approved','approved');
CREATE INDEX idx_sales_submitter ON public.sale_observations(submitted_by_user_id);

ALTER TABLE public.sale_observations ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view non-rejected sales
CREATE POLICY "View active sales" ON public.sale_observations
  FOR SELECT TO authenticated
  USING (moderation_status IN ('auto_approved','approved','pending_review'));

-- Authenticated users can submit (community submissions)
CREATE POLICY "Submit sales" ON public.sale_observations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitted_by_user_id AND source = 'user_submitted');

-- Submitter can delete their own pending/approved submissions
CREATE POLICY "Delete own sales" ON public.sale_observations
  FOR DELETE TO authenticated USING (auth.uid() = submitted_by_user_id);

-- Sale confirmations: "I saw it too"
CREATE TABLE public.sale_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_observation_id uuid NOT NULL REFERENCES public.sale_observations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sale_observation_id, user_id)
);
ALTER TABLE public.sale_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View confirmations" ON public.sale_confirmations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own confirmation" ON public.sale_confirmations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own confirmation" ON public.sale_confirmations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Sale flags: abuse reports
CREATE TABLE public.sale_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_observation_id uuid NOT NULL REFERENCES public.sale_observations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  notes text,
  flagged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sale_observation_id, user_id)
);
ALTER TABLE public.sale_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert own flag" ON public.sale_flags
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "View own flags" ON public.sale_flags
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Trigger: keep confirmation_count and flag_count in sync
CREATE OR REPLACE FUNCTION public.bump_sale_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'sale_confirmations' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.sale_observations SET confirmation_count = confirmation_count + 1 WHERE id = NEW.sale_observation_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.sale_observations SET confirmation_count = GREATEST(confirmation_count - 1, 0) WHERE id = OLD.sale_observation_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'sale_flags' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.sale_observations
        SET flag_count = flag_count + 1,
            moderation_status = CASE WHEN flag_count + 1 >= 3 THEN 'pending_review' ELSE moderation_status END
        WHERE id = NEW.sale_observation_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;

CREATE TRIGGER trg_confirmation_count
  AFTER INSERT OR DELETE ON public.sale_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.bump_sale_counts();
CREATE TRIGGER trg_flag_count
  AFTER INSERT ON public.sale_flags
  FOR EACH ROW EXECUTE FUNCTION public.bump_sale_counts();
