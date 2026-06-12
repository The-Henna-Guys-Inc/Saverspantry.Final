-- Extend pantry_items RLS to support household sharing.
DROP POLICY IF EXISTS "Users view own pantry_items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users insert own pantry_items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users update own pantry_items" ON public.pantry_items;
DROP POLICY IF EXISTS "Users delete own pantry_items" ON public.pantry_items;

CREATE POLICY "Users view own or household pantry_items"
  ON public.pantry_items FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()))
  );

CREATE POLICY "Users insert own or household pantry_items"
  ON public.pantry_items FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (household_id IS NULL OR public.is_household_member(household_id, auth.uid()))
  );

CREATE POLICY "Users update own or household pantry_items"
  ON public.pantry_items FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()))
  )
  WITH CHECK (
    auth.uid() = user_id
    OR (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()))
  );

CREATE POLICY "Users delete own or household pantry_items"
  ON public.pantry_items FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()))
  );
