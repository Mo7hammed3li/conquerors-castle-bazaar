
CREATE POLICY "listing images read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'listing-images');
CREATE POLICY "listing images upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "listing images delete own or admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'listing-images' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
