
-- 1) admin_session_settings: hide raw row, expose only timeout values via function
DROP POLICY IF EXISTS "Anyone authenticated views session settings" ON public.admin_session_settings;

CREATE POLICY "Admins view session settings"
ON public.admin_session_settings
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_session_timeout_settings()
RETURNS TABLE(session_max_hours integer, idle_timeout_minutes integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT session_max_hours, idle_timeout_minutes
  FROM public.admin_session_settings
  WHERE id = true
$$;

REVOKE ALL ON FUNCTION public.get_session_timeout_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_session_timeout_settings() TO authenticated;

-- 2) city_waitlist: bind user_id to auth.uid() when authenticated
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.city_waitlist;

CREATE POLICY "Anon can join waitlist"
ON public.city_waitlist
FOR INSERT TO anon
WITH CHECK (user_id IS NULL);

CREATE POLICY "Authenticated users join own waitlist"
ON public.city_waitlist
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 3) household_invites: remove broad read, expose only via code lookup function
DROP POLICY IF EXISTS "Anyone reads invite by code lookup" ON public.household_invites;

CREATE OR REPLACE FUNCTION public.get_invite_by_code(_code text)
RETURNS TABLE(id uuid, household_id uuid, expires_at timestamptz, accepted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, household_id, expires_at, accepted_at
  FROM public.household_invites
  WHERE code = upper(trim(_code))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_invite_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_invite_by_code(text) TO authenticated;

-- Allow the invitee to mark the invite accepted by code (UPDATE policy already
-- covers non-accepted, non-expired invites, so redemption keeps working).

-- 4) nutrition_search_events: owner-only SELECT
DROP POLICY IF EXISTS "Authenticated users can read nutrition search aggregates" ON public.nutrition_search_events;

CREATE POLICY "Users read own nutrition searches"
ON public.nutrition_search_events
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 5) sale_confirmations: owner-only SELECT
DROP POLICY IF EXISTS "View confirmations" ON public.sale_confirmations;

CREATE POLICY "Users view own confirmations"
ON public.sale_confirmations
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
