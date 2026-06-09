-- Phase 8: access levels (грифы), RLS, temporary access grants

-- =============================================================================
-- 1. User clearance on profiles
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_level_id uuid
    REFERENCES public.ref_access_levels(id) ON DELETE SET NULL;

UPDATE public.profiles p
SET access_level_id = al.id
FROM public.ref_access_levels al
WHERE p.access_level_id IS NULL
  AND al.code = 'internal';

-- =============================================================================
-- 2. Access level helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_access_level_order(_user uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(al.level_order, 1)
  FROM public.profiles p
  LEFT JOIN public.ref_access_levels al ON al.id = p.access_level_id
  WHERE p.id = _user;
$$;

CREATE OR REPLACE FUNCTION public.document_access_level_order(_doc_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(al.level_order, 1)
  FROM public.documents d
  LEFT JOIN public.ref_access_levels al ON al.id = d.access_level_id
  WHERE d.id = _doc_id;
$$;

-- =============================================================================
-- 3. Document access grants (table before functions that reference it)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  reason text NOT NULL DEFAULT '',
  review_note text,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_access_grants_doc_user
  ON public.document_access_grants (document_id, user_id);

CREATE INDEX IF NOT EXISTS idx_document_access_grants_status
  ON public.document_access_grants (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.document_access_grants TO authenticated;
GRANT ALL ON public.document_access_grants TO service_role;
ALTER TABLE public.document_access_grants ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_document_access_grants_updated ON public.document_access_grants;
CREATE TRIGGER trg_document_access_grants_updated
  BEFORE UPDATE ON public.document_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "dag_select" ON public.document_access_grants;
CREATE POLICY "dag_select" ON public.document_access_grants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR requested_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_access_grants.document_id
        AND d.created_by = auth.uid()
    )
    OR public.user_has_permission(auth.uid(), 'view_all_documents')
  );

DROP POLICY IF EXISTS "dag_insert_own" ON public.document_access_grants;
CREATE POLICY "dag_insert_own" ON public.document_access_grants
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND user_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "dag_review" ON public.document_access_grants;
CREATE POLICY "dag_review" ON public.document_access_grants
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_access_grants.document_id
        AND d.created_by = auth.uid()
    )
    OR public.user_has_permission(auth.uid(), 'view_all_documents')
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_access_grants.document_id
        AND d.created_by = auth.uid()
    )
    OR public.user_has_permission(auth.uid(), 'view_all_documents')
  );

-- =============================================================================
-- 4. Access check functions (after grants table)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.can_view_document_content(_doc_id uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = _doc_id
      AND (
        public.is_admin(_user)
        OR d.created_by = _user
        OR d.assigned_to = _user
        OR EXISTS (
          SELECT 1
          FROM public.workflow_tasks t
          WHERE t.document_id = _doc_id
            AND t.assignee_id = _user
        )
        OR EXISTS (
          SELECT 1
          FROM public.document_access_grants g
          WHERE g.document_id = _doc_id
            AND g.user_id = _user
            AND g.status = 'approved'
            AND (g.expires_at IS NULL OR g.expires_at > now())
        )
        OR public.user_access_level_order(_user) >= public.document_access_level_order(_doc_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_document(_doc_id uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_view_document_content(_doc_id, _user)
    OR public.user_has_permission(_user, 'view_all_documents')
    OR public.has_role(_user, 'archivist');
$$;

GRANT EXECUTE ON FUNCTION public.user_access_level_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.document_access_level_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_document_content(uuid, uuid) TO authenticated, service_role;

-- =============================================================================
-- 5. Documents RLS — use unified can_view_document
-- =============================================================================

DROP POLICY IF EXISTS "doc_select_participants" ON public.documents;
CREATE POLICY "doc_select_participants" ON public.documents
  FOR SELECT TO authenticated
  USING (public.can_view_document(id, auth.uid()));

-- Sensitive child tables — require content clearance
DROP POLICY IF EXISTS "dv_select_participants" ON public.document_versions;
CREATE POLICY "dv_select_participants" ON public.document_versions
  FOR SELECT TO authenticated
  USING (public.can_view_document_content(document_id, auth.uid()));

DROP POLICY IF EXISTS "cmt_select_participants" ON public.document_comments;
CREATE POLICY "cmt_select_participants" ON public.document_comments
  FOR SELECT TO authenticated
  USING (public.can_view_document_content(document_id, auth.uid()));

DROP POLICY IF EXISTS "sig_select_participants" ON public.document_signatures;
CREATE POLICY "sig_select_participants" ON public.document_signatures
  FOR SELECT TO authenticated
  USING (public.can_view_document_content(document_id, auth.uid()));

-- =============================================================================
-- 6. FTS search respects access
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_documents_fts(
  _query text,
  _status text DEFAULT NULL,
  _document_type_code text DEFAULT NULL,
  _scope_user uuid DEFAULT NULL,
  _scope text DEFAULT 'all',
  _limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  reg_number text,
  title_ru text,
  title_kk text,
  status document_status,
  doc_type text,
  sla_status sla_status,
  due_at timestamptz,
  created_at timestamptz,
  rank real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q tsquery;
  v_clean text;
BEGIN
  v_clean := btrim(coalesce(_query, ''));
  IF length(v_clean) < 2 THEN
    RETURN;
  END IF;

  v_q := plainto_tsquery('simple', v_clean);

  RETURN QUERY
  SELECT
    d.id,
    d.reg_number,
    d.title_ru,
    d.title_kk,
    d.status,
    d.doc_type,
    d.sla_status,
    d.due_at,
    d.created_at,
    ts_rank(d.search_tsv, v_q) AS rank
  FROM public.documents d
  LEFT JOIN public.ref_document_types dt ON dt.id = d.document_type_id
  WHERE d.search_tsv @@ v_q
    AND (_status IS NULL OR d.status::text = _status)
    AND (_document_type_code IS NULL OR dt.code = _document_type_code OR d.doc_type = _document_type_code)
    AND (
      _scope_user IS NULL
      OR public.can_view_document(d.id, _scope_user)
    )
    AND (
      _scope = 'all'
      OR (_scope = 'mine' AND d.created_by = _scope_user)
      OR (_scope = 'assigned' AND d.assigned_to = _scope_user)
      OR (_scope = 'archive' AND d.status = 'archived')
    )
  ORDER BY rank DESC, d.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
END;
$$;
