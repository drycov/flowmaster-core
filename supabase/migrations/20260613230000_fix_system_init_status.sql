-- First-run detection: separate bootstrap (no admin) from setup checklist.
-- service_role only (PostgREST); UI reads via server functions.

CREATE OR REPLACE FUNCTION public.get_system_init_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org jsonb;
  v_org_name text;
  v_org_slug text;
  v_admin_count int;
  v_dept_count int;
  v_perm_count int;
  v_role_count int;
  v_wf_published int;
  v_tpl_published int;
  v_org_configured boolean;
  v_needs_bootstrap boolean;
  v_needs_setup boolean;
BEGIN
  SELECT to_jsonb(o)
    INTO v_org
    FROM public.organization o
   ORDER BY o.created_at
   LIMIT 1;

  v_org_name := COALESCE(v_org->>'name_ru', '');
  v_org_slug := lower(trim(COALESCE(v_org->>'slug', '')));

  SELECT count(*)::int
    INTO v_admin_count
    FROM public.user_roles
   WHERE role = 'admin';

  IF v_admin_count = 0 THEN
    SELECT count(DISTINCT g.user_id)::int
      INTO v_admin_count
      FROM public.user_role_grants g
      JOIN public.roles r ON r.id = g.role_id
     WHERE r.code = 'admin'
       AND g.revoked_at IS NULL;
  END IF;

  SELECT count(*)::int INTO v_dept_count FROM public.departments;
  SELECT count(*)::int INTO v_perm_count FROM public.permissions;
  SELECT count(*)::int INTO v_role_count FROM public.roles WHERE is_active;
  SELECT count(*)::int INTO v_wf_published FROM public.workflows WHERE status = 'published';
  SELECT count(*)::int INTO v_tpl_published FROM public.document_templates WHERE status = 'published';

  v_org_configured := v_org IS NOT NULL
    AND v_org_name NOT IN ('', 'Моя организация')
    AND v_org_slug NOT IN ('', 'default');

  v_needs_bootstrap := v_admin_count = 0;
  v_needs_setup := v_needs_bootstrap OR NOT v_org_configured OR v_dept_count = 0;

  RETURN jsonb_build_object(
    'has_organization', v_org IS NOT NULL,
    'organization_configured', v_org_configured,
    'has_admin', v_admin_count > 0,
    'admin_count', v_admin_count,
    'departments_count', v_dept_count,
    'permissions_count', v_perm_count,
    'roles_count', v_role_count,
    'published_workflows', v_wf_published,
    'published_templates', v_tpl_published,
    'needs_bootstrap', v_needs_bootstrap,
    'needs_setup', v_needs_setup
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_system_init_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_init_status() TO service_role;

NOTIFY pgrst, 'reload schema';
