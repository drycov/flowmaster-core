-- Fix swapped can_view_document(_doc_id, _user) arguments introduced in phase11.

DROP POLICY IF EXISTS contract_details_select ON public.contract_details;
CREATE POLICY contract_details_select ON public.contract_details FOR SELECT TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'view_all_documents')
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = contract_details.document_id
        AND (d.created_by = auth.uid() OR d.assigned_to = auth.uid())
    )
    OR public.can_view_document(contract_details.document_id, auth.uid())
  );

DROP POLICY IF EXISTS document_correspondents_select ON public.document_correspondents;
CREATE POLICY document_correspondents_select ON public.document_correspondents FOR SELECT TO authenticated
  USING (public.can_view_document(document_id, auth.uid()));
