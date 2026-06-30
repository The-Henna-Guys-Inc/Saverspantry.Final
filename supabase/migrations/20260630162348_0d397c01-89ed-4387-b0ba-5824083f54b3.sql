
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_store_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorites_filter_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.enforce_favorite_stores_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.favorite_store_ids IS NOT NULL AND array_length(NEW.favorite_store_ids, 1) > 3 THEN
    RAISE EXCEPTION 'You can save at most 3 favorite stores';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_favorite_stores_limit ON public.profiles;
CREATE TRIGGER trg_profiles_favorite_stores_limit
  BEFORE INSERT OR UPDATE OF favorite_store_ids ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_favorite_stores_limit();
