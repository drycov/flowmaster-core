-- Supabase Storage buckets + RLS tied to authenticated users

-- Helper: can user access document files?
CREATE OR REPLACE FUNCTION public.user_can_access_document(_user uuid, _document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.documents d
     WHERE d.id = _document_id
       AND (
         d.created_by = _user
         OR d.assigned_to = _user
         OR public.user_has_permission(_user, 'view_all_documents')
         OR EXISTS (
           SELECT 1 FROM public.workflow_tasks t
            WHERE t.document_id = d.id AND t.assignee_id = _user
         )
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_document(uuid, uuid) TO authenticated;

-- Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  ),
  (
    'documents',
    'documents',
    false,
    52428800,
    NULL
  ),
  (
    'templates',
    'templates',
    false,
    20971520,
    ARRAY[
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'application/msword'
    ]::text[]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============== AVATARS (public read, owner write) ===============
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "documents_participant_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_participant_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_participant_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_participant_delete" ON storage.objects;
DROP POLICY IF EXISTS "templates_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "templates_manager_insert" ON storage.objects;
DROP POLICY IF EXISTS "templates_manager_update" ON storage.objects;
DROP POLICY IF EXISTS "templates_manager_delete" ON storage.objects;

CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============== DOCUMENTS (private, participants only) ===============
CREATE POLICY "documents_participant_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.user_can_access_document(
      auth.uid(),
      (split_part(name, '/', 1))::uuid
    )
  );

CREATE POLICY "documents_participant_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.user_can_access_document(
      auth.uid(),
      (split_part(name, '/', 1))::uuid
    )
  );

CREATE POLICY "documents_participant_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.user_can_access_document(
      auth.uid(),
      (split_part(name, '/', 1))::uuid
    )
  );

CREATE POLICY "documents_participant_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.user_can_access_document(
      auth.uid(),
      (split_part(name, '/', 1))::uuid
    )
  );

-- =============== TEMPLATES (read: authenticated, write: manage_templates) ===============
CREATE POLICY "templates_auth_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'templates');

CREATE POLICY "templates_manager_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'templates'
    AND public.user_has_permission(auth.uid(), 'manage_templates')
  );

CREATE POLICY "templates_manager_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'templates'
    AND public.user_has_permission(auth.uid(), 'manage_templates')
  );

CREATE POLICY "templates_manager_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'templates'
    AND public.user_has_permission(auth.uid(), 'manage_templates')
  );
