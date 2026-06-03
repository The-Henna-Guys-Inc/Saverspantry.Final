
-- 1. Replace permissive UPDATE policy on household_invites
DROP POLICY IF EXISTS "Invitee or member updates invite" ON public.household_invites;
CREATE POLICY "Members update invites"
  ON public.household_invites FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

-- Secure RPC for invite redemption (atomic, validates code + expiry)
CREATE OR REPLACE FUNCTION public.redeem_household_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_invite public.household_invites%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite
    FROM public.household_invites
   WHERE code = upper(trim(_code))
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite already used';
  END IF;
  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;

  INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (v_invite.household_id, v_user, 'member')
    ON CONFLICT DO NOTHING;

  UPDATE public.household_invites
     SET accepted_at = now(), accepted_by_user_id = v_user
   WHERE id = v_invite.id;

  UPDATE public.profiles
     SET active_household_id = v_invite.household_id
   WHERE user_id = v_user;

  RETURN v_invite.household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_household_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_household_invite(text) TO authenticated;

-- 2. Tighten nutrition_search_events INSERT to own user_id
DROP POLICY IF EXISTS "Authenticated users can log nutrition searches" ON public.nutrition_search_events;
CREATE POLICY "Users log own nutrition searches"
  ON public.nutrition_search_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Allow self-cancellation of account deletion requests
CREATE POLICY "Users cancel own deletion request"
  ON public.account_deletion_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
