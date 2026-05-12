-- 1. Households
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- 2. Members
CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_household_members_user ON public.household_members(user_id);
CREATE INDEX idx_household_members_household ON public.household_members(household_id);

-- 3. Invites
CREATE TABLE public.household_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  invited_by_user_id UUID NOT NULL,
  invited_email TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_household_invites_household ON public.household_invites(household_id);
CREATE INDEX idx_household_invites_code ON public.household_invites(code);

-- 4. Active household pointer on profile
ALTER TABLE public.profiles ADD COLUMN active_household_id UUID;

-- 5. Membership helper (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_household_member(_household_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = _household_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_household_owner(_household_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.households
    WHERE id = _household_id AND owner_user_id = _user_id
  )
$$;

-- 6. RLS — households
CREATE POLICY "Members view household"
  ON public.households FOR SELECT TO authenticated
  USING (public.is_household_member(id, auth.uid()));

CREATE POLICY "Users create households"
  ON public.households FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owner updates household"
  ON public.households FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Owner deletes household"
  ON public.households FOR DELETE TO authenticated
  USING (auth.uid() = owner_user_id);

-- 7. RLS — members
CREATE POLICY "Members view co-members"
  ON public.household_members FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "Owner adds members"
  ON public.household_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_household_owner(household_id, auth.uid())
    OR auth.uid() = user_id  -- a user accepting an invite adds themselves
  );

CREATE POLICY "Owner removes members or self leaves"
  ON public.household_members FOR DELETE TO authenticated
  USING (
    public.is_household_owner(household_id, auth.uid())
    OR (auth.uid() = user_id AND role <> 'owner')
  );

-- 8. RLS — invites
CREATE POLICY "Members view invites"
  ON public.household_invites FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

-- Allow anyone authenticated to look up an invite by code (for join flow)
CREATE POLICY "Anyone reads invite by code lookup"
  ON public.household_invites FOR SELECT TO authenticated
  USING (accepted_at IS NULL AND expires_at > now());

CREATE POLICY "Members create invites"
  ON public.household_invites FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = invited_by_user_id
    AND public.is_household_member(household_id, auth.uid())
  );

CREATE POLICY "Invitee or member updates invite"
  ON public.household_invites FOR UPDATE TO authenticated
  USING (
    public.is_household_member(household_id, auth.uid())
    OR (accepted_at IS NULL AND expires_at > now())
  );

CREATE POLICY "Members delete invites"
  ON public.household_invites FOR DELETE TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

-- 9. Auto-add owner as member when household is created
CREATE OR REPLACE FUNCTION public.add_household_owner_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (NEW.id, NEW.owner_user_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_add_household_owner_as_member
  AFTER INSERT ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.add_household_owner_as_member();

CREATE TRIGGER trg_households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();