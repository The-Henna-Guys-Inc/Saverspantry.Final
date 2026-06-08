
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_cron_secret(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_sale_counts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_swap_savings() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_household_owner_as_member() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_support_ticket() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_alert(text, text, text, text, jsonb, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._cron_secret_header() FROM anon, authenticated;

DROP POLICY IF EXISTS "Public read dish images" ON storage.objects;
