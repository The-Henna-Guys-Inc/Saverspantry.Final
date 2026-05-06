
-- Admins can insert admin_curated sales
CREATE POLICY "Admins insert curated sales"
ON public.sale_observations
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND source = 'admin_curated');

-- Admins can update any sale (moderation, edits)
CREATE POLICY "Admins update sales"
ON public.sale_observations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete any sale (moderation)
CREATE POLICY "Admins delete sales"
ON public.sale_observations
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
