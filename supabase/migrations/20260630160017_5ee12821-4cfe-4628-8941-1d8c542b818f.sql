
-- Public read for dish-images (bucket is intentionally public for display)
CREATE POLICY "Public read access to dish-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'dish-images');

-- Block all client-side writes; service role bypasses RLS so edge functions still work
CREATE POLICY "Block client inserts to dish-images"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'dish-images' AND false);

CREATE POLICY "Block client updates to dish-images"
ON storage.objects FOR UPDATE
TO authenticated, anon
USING (bucket_id = 'dish-images' AND false);

CREATE POLICY "Block client deletes from dish-images"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (bucket_id = 'dish-images' AND false);
