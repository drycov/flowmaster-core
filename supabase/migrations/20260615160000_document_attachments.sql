-- Document file attachments (вложения), separate from version history.

CREATE TABLE IF NOT EXISTS public.document_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organization(id) ON DELETE RESTRICT,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_attachments_path_unique UNIQUE (file_path)
);

CREATE INDEX IF NOT EXISTS idx_document_attachments_document
  ON public.document_attachments (document_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_document_attachments_org
  ON public.document_attachments (organization_id);

GRANT SELECT, INSERT, DELETE ON public.document_attachments TO authenticated;
GRANT ALL ON public.document_attachments TO service_role;

ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "da_select_participants" ON public.document_attachments
  FOR SELECT TO authenticated
  USING (public.can_view_document(document_id, auth.uid()));

CREATE POLICY "da_insert_editor" ON public.document_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.can_view_document(document_id, auth.uid())
  );

CREATE POLICY "da_delete_owner_or_admin" ON public.document_attachments
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_document_attachments_set_org ON public.document_attachments;
CREATE TRIGGER trg_document_attachments_set_org
  BEFORE INSERT ON public.document_attachments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_document_sidecar_organization();

DROP TRIGGER IF EXISTS trg_audit_document_attachments ON public.document_attachments;
CREATE TRIGGER trg_audit_document_attachments
  AFTER INSERT OR DELETE ON public.document_attachments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
