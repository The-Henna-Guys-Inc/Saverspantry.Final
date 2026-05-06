CREATE POLICY "Admins insert curated stores"
ON public.specialty_stores
FOR INSERT
TO authenticated
WITH CHECK (curation_source = 'admin_curated' AND EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
));

CREATE POLICY "Admins update stores"
ON public.specialty_stores
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
));

CREATE POLICY "Admins delete stores"
ON public.specialty_stores
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
));