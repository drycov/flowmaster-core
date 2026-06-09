-- Align storage bucket policies with document clearance (access levels)

DROP POLICY IF EXISTS "documents_participant_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_participant_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_participant_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_participant_delete" ON storage.objects;

CREATE POLICY "documents_participant_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.can_view_document_content(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );

CREATE POLICY "documents_participant_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.can_view_document_content(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );

CREATE POLICY "documents_participant_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.can_view_document_content(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );

CREATE POLICY "documents_participant_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.can_view_document_content(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );

DROP POLICY IF EXISTS "signatures_participant_select" ON storage.objects;
DROP POLICY IF EXISTS "signatures_participant_insert" ON storage.objects;
DROP POLICY IF EXISTS "signatures_participant_update" ON storage.objects;
DROP POLICY IF EXISTS "signatures_participant_delete" ON storage.objects;

CREATE POLICY "signatures_participant_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND public.can_view_document_content(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );

CREATE POLICY "signatures_participant_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'signatures'
    AND public.can_view_document_content(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );

CREATE POLICY "signatures_participant_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'signatures'
    AND public.can_view_document_content(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );

CREATE POLICY "signatures_participant_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'signatures'
    AND public.can_view_document_content(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );
