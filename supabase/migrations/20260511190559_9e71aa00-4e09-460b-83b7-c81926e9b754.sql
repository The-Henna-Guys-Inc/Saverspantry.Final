
CREATE TABLE public.nutrition_search_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query text NOT NULL,
  normalized_query text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nutrition_search_events_normalized
  ON public.nutrition_search_events (normalized_query);
CREATE INDEX idx_nutrition_search_events_created_at
  ON public.nutrition_search_events (created_at DESC);

ALTER TABLE public.nutrition_search_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can log nutrition searches"
  ON public.nutrition_search_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read nutrition search aggregates"
  ON public.nutrition_search_events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.top_nutrition_searches(_limit int DEFAULT 10)
RETURNS TABLE(query text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (array_agg(query ORDER BY created_at DESC))[1] AS query,
    COUNT(*)::bigint AS count
  FROM public.nutrition_search_events
  WHERE created_at > now() - interval '60 days'
  GROUP BY normalized_query
  ORDER BY count DESC, MAX(created_at) DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.top_nutrition_searches(int) TO authenticated, anon;
