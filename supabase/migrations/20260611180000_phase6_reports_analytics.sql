-- Phase 6: EDMS reports & analytics RPC

CREATE OR REPLACE FUNCTION public.get_edms_reports(
  _user uuid,
  _days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days int := GREATEST(1, LEAST(COALESCE(_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => v_days);
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.is_admin(_user)
     AND NOT public.user_has_permission(_user, 'view_all_documents') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'period_days', v_days,
    'generated_at', now(),
    'documents_by_status', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('status', status, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (
        SELECT status::text, count(*)::int AS cnt
        FROM public.documents
        GROUP BY status
      ) s
    ),
    'documents_by_type', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'code', type_code,
        'name_ru', name_ru,
        'name_kk', name_kk,
        'count', cnt
      ) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (
        SELECT
          COALESCE(dt.code, d.doc_type, 'unknown') AS type_code,
          COALESCE(dt.name_ru, d.doc_type, 'Не указан') AS name_ru,
          COALESCE(dt.name_kk, d.doc_type, 'Көрсетілмеген') AS name_kk,
          count(*)::int AS cnt
        FROM public.documents d
        LEFT JOIN public.ref_document_types dt ON dt.id = d.document_type_id
        GROUP BY 1, 2, 3
      ) t
    ),
    'documents_timeline', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day), '[]'::jsonb)
      FROM (
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               count(*)::int AS cnt
        FROM public.documents
        WHERE created_at >= v_since
        GROUP BY 1
      ) tl
    ),
    'sla_summary', (
      SELECT jsonb_build_object(
        'ok', count(*) FILTER (WHERE sla_status = 'ok'),
        'warning', count(*) FILTER (WHERE sla_status = 'warning'),
        'overdue', count(*) FILTER (WHERE sla_status = 'overdue')
      )
      FROM public.documents
      WHERE status NOT IN ('archived', 'cancelled')
    ),
    'workflow_tasks', (
      SELECT jsonb_build_object(
        'pending', count(*) FILTER (WHERE status = 'pending'),
        'completed', count(*) FILTER (WHERE status = 'completed'),
        'rejected', count(*) FILTER (WHERE status = 'rejected'),
        'returned', count(*) FILTER (WHERE status = 'returned'),
        'avg_completion_hours', round(
          avg(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600.0)
            FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL AND created_at >= v_since)
        , 1)
      )
      FROM public.workflow_tasks
    ),
    'correspondence', (
      SELECT jsonb_build_object(
        'incoming', count(*) FILTER (WHERE COALESCE(dt.code, d.doc_type) = 'incoming'),
        'outgoing', count(*) FILTER (WHERE COALESCE(dt.code, d.doc_type) = 'outgoing'),
        'internal', count(*) FILTER (WHERE COALESCE(dt.code, d.doc_type) = 'internal')
      )
      FROM public.documents d
      LEFT JOIN public.ref_document_types dt ON dt.id = d.document_type_id
    ),
    'archive', (
      SELECT jsonb_build_object(
        'archived', count(*) FILTER (WHERE status = 'archived'),
        'legal_hold', count(*) FILTER (WHERE legal_hold = true),
        'expiring_30d', count(*) FILTER (
          WHERE legal_hold = false
            AND retention_due_at IS NOT NULL
            AND retention_due_at <= now() + interval '30 days'
            AND status IN ('approved', 'signed', 'in_review')
        )
      )
      FROM public.documents
    ),
    'totals', (
      SELECT jsonb_build_object(
        'documents', count(*)::int,
        'created_in_period', count(*) FILTER (WHERE created_at >= v_since)::int
      )
      FROM public.documents
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_edms_reports(uuid, int) TO authenticated, service_role;
