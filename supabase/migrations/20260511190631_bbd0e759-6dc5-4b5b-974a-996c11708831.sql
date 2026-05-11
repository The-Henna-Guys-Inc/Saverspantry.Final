
CREATE OR REPLACE FUNCTION public.top_nutrition_searches(_limit int DEFAULT 10)
RETURNS TABLE(query text, count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
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

REVOKE EXECUTE ON FUNCTION public.top_nutrition_searches(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.top_nutrition_searches(int) TO authenticated;
