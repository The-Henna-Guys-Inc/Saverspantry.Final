
CREATE TABLE public.ai_usage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  function_name TEXT NOT NULL,
  model TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_estimate_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_usage_user_time ON public.ai_usage_log(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_fn_time ON public.ai_usage_log(function_name, created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai usage" ON public.ai_usage_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all ai usage" ON public.ai_usage_log
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TABLE public.ai_response_cache (
  cache_key TEXT NOT NULL PRIMARY KEY,
  function_name TEXT NOT NULL,
  response JSONB NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_ai_cache_expiry ON public.ai_response_cache(expires_at);
CREATE INDEX idx_ai_cache_fn ON public.ai_response_cache(function_name);

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view ai cache" ON public.ai_response_cache
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
