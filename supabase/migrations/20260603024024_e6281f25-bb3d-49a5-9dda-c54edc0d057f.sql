
-- 1) Seed cron secret in vault if missing.
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_secret') INTO v_exists;
  IF NOT v_exists THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'cron_secret', 'Shared secret for pg_cron-triggered edge functions');
  END IF;
END$$;

-- 2) Privileged helper for edge functions to verify the secret using their service-role client.
CREATE OR REPLACE FUNCTION public.verify_cron_secret(_secret text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'cron_secret' AND decrypted_secret = _secret
  );
$$;

REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;

-- 3) Helper to fetch the secret inside cron commands (runs as postgres, has vault access).
CREATE OR REPLACE FUNCTION public._cron_secret_header()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault
AS $$
  SELECT jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhYWppZnF2d21vcXR0ZWZ4eWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMjE0MjksImV4cCI6MjA5MzU5NzQyOX0.FXWy8ghLouXiif3GlLdG45yrwHbgP_LKOWXvpTxIZzE',
    'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
  );
$$;

REVOKE ALL ON FUNCTION public._cron_secret_header() FROM PUBLIC, anon, authenticated;

-- 4) Re-schedule each cron job with the secret header.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT jobname FROM cron.job WHERE jobname IN (
      'pantry-expiry-check',
      'weekly-savings-rollup',
      'watchlist-sale-matcher',
      'purge-deleted-accounts-daily',
      'ops-monitor-hourly',
      'cleanup-stale-places-nightly',
      'bulk-buy-rebuild-nightly',
      'usda-food-plans-monthly'
    )
  LOOP
    PERFORM cron.unschedule(rec.jobname);
  END LOOP;
END$$;

SELECT cron.schedule(
  'pantry-expiry-check',
  '0 8 * * *',
  $cron$SELECT net.http_post(
    url:='https://paajifqvwmoqttefxykw.supabase.co/functions/v1/pantry-expiry-check',
    headers:=public._cron_secret_header(),
    body:='{}'::jsonb
  );$cron$
);

SELECT cron.schedule(
  'weekly-savings-rollup',
  '0 23 * * 0',
  $cron$SELECT net.http_post(
    url:='https://paajifqvwmoqttefxykw.supabase.co/functions/v1/weekly-savings-rollup',
    headers:=public._cron_secret_header(),
    body:='{}'::jsonb
  );$cron$
);

SELECT cron.schedule(
  'watchlist-sale-matcher',
  '*/30 * * * *',
  $cron$SELECT net.http_post(
    url:='https://paajifqvwmoqttefxykw.supabase.co/functions/v1/watchlist-sale-matcher',
    headers:=public._cron_secret_header(),
    body:='{}'::jsonb
  );$cron$
);

SELECT cron.schedule(
  'purge-deleted-accounts-daily',
  '0 3 * * *',
  $cron$SELECT net.http_post(
    url:='https://paajifqvwmoqttefxykw.supabase.co/functions/v1/purge-deleted-accounts',
    headers:=public._cron_secret_header(),
    body:=jsonb_build_object('time', now())
  );$cron$
);

SELECT cron.schedule(
  'ops-monitor-hourly',
  '0 * * * *',
  $cron$SELECT net.http_post(
    url:='https://paajifqvwmoqttefxykw.supabase.co/functions/v1/ops-monitor',
    headers:=public._cron_secret_header(),
    body:='{}'::jsonb
  );$cron$
);

SELECT cron.schedule(
  'cleanup-stale-places-nightly',
  '0 3 * * *',
  $cron$SELECT net.http_post(
    url:='https://paajifqvwmoqttefxykw.supabase.co/functions/v1/cleanup-stale-places',
    headers:=public._cron_secret_header(),
    body:=jsonb_build_object('time', now())
  );$cron$
);

SELECT cron.schedule(
  'bulk-buy-rebuild-nightly',
  '30 3 * * *',
  $cron$SELECT net.http_post(
    url:='https://paajifqvwmoqttefxykw.supabase.co/functions/v1/bulk-buy-rebuild',
    headers:=public._cron_secret_header(),
    body:=jsonb_build_object('time', now())
  );$cron$
);

SELECT cron.schedule(
  'usda-food-plans-monthly',
  '0 10 1 * *',
  $cron$SELECT net.http_post(
    url:='https://paajifqvwmoqttefxykw.supabase.co/functions/v1/usda-food-plans-sync',
    headers:=public._cron_secret_header(),
    body:='{"triggered_by":"cron"}'::jsonb
  );$cron$
);
