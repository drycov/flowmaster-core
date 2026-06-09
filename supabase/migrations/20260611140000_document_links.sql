-- Phase 2: document links (связи между документами)

CREATE TABLE IF NOT EXISTS public.document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  target_document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  link_type_id uuid NOT NULL REFERENCES public.ref_document_link_types(id),
  note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_links_no_self CHECK (source_document_id <> target_document_id),
  CONSTRAINT document_links_unique UNIQUE (source_document_id, target_document_id, link_type_id)
);

CREATE INDEX IF NOT EXISTS idx_document_links_source ON public.document_links(source_document_id);
CREATE INDEX IF NOT EXISTS idx_document_links_target ON public.document_links(target_document_id);
CREATE INDEX IF NOT EXISTS idx_document_links_type ON public.document_links(link_type_id);

GRANT SELECT, INSERT, DELETE ON public.document_links TO authenticated;
GRANT ALL ON public.document_links TO service_role;

ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dl_select_participants" ON public.document_links
  FOR SELECT TO authenticated
  USING (
    public.can_view_document(source_document_id, auth.uid())
    OR public.can_view_document(target_document_id, auth.uid())
  );

CREATE POLICY "dl_insert_participants" ON public.document_links
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.can_view_document(source_document_id, auth.uid())
    AND public.can_view_document(target_document_id, auth.uid())
  );

CREATE POLICY "dl_delete_owner_or_admin" ON public.document_links
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_audit_document_links ON public.document_links;
CREATE TRIGGER trg_audit_document_links
  AFTER INSERT OR DELETE ON public.document_links
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
