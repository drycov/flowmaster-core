-- Fix stamp_organization_from_document(): accessing NEW.source_document_id or NEW.document_id
-- on tables that lack those columns caused "record \"new\" has no field \"source_document_id\""
-- during document INSERT (sidecar sync → child row triggers).

CREATE OR REPLACE FUNCTION public.stamp_organization_from_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_doc_id uuid;
  v_row jsonb;
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_row := to_jsonb(NEW);

  IF TG_TABLE_NAME = 'document_links' AND v_row ? 'source_document_id' THEN
    v_doc_id := NULLIF(trim(v_row->>'source_document_id'), '')::uuid;
  ELSIF v_row ? 'document_id' THEN
    v_doc_id := NULLIF(trim(v_row->>'document_id'), '')::uuid;
  END IF;

  IF v_doc_id IS NOT NULL THEN
    SELECT d.organization_id INTO NEW.organization_id
    FROM public.documents d
    WHERE d.id = v_doc_id;
  END IF;

  NEW.organization_id := COALESCE(
    NEW.organization_id,
    public.effective_organization_id(),
    public.current_organization_id()
  );

  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.stamp_document_sidecar_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_doc_id uuid;
  v_row jsonb;
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_row := to_jsonb(NEW);
  IF v_row ? 'document_id' THEN
    v_doc_id := NULLIF(trim(v_row->>'document_id'), '')::uuid;
  END IF;

  IF v_doc_id IS NOT NULL THEN
    SELECT d.organization_id INTO NEW.organization_id
    FROM public.documents d
    WHERE d.id = v_doc_id;
  END IF;

  NEW.organization_id := COALESCE(
    NEW.organization_id,
    public.effective_organization_id(),
    public.current_organization_id()
  );

  RETURN NEW;
END;
$fn$;

-- Drop stamp_organization_from_document from any table outside the intended whitelist.
DO $do$
DECLARE
  r record;
  allowed text[] := ARRAY[
    'workflow_runs',
    'workflow_tasks',
    'workflow_events',
    'document_versions',
    'document_signatures',
    'document_comments',
    'document_access_grants',
    'document_correspondents',
    'contract_details',
    'document_links'
  ];
BEGIN
  FOR r IN
    SELECT tg.tgname, c.relname AS table_name
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE n.nspname = 'public'
      AND NOT tg.tgisinternal
      AND p.proname = 'stamp_organization_from_document'
      AND NOT (c.relname = ANY(allowed))
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.tgname, r.table_name);
    RAISE NOTICE 'dropped misplaced trigger % on %', r.tgname, r.table_name;
  END LOOP;
END $do$;

-- Drop mis-placed stamp triggers (documents + sidecars must not use stamp_organization_from_document).
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'documents',
    'document_registration',
    'document_classification',
    'document_archive',
    'document_lifecycle'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_stamp_org ON public.%I', t, t);
    END IF;
  END LOOP;
END $do$;

-- Re-apply intended stamp_organization_from_document triggers only.
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workflow_runs',
    'workflow_tasks',
    'workflow_events',
    'document_versions',
    'document_signatures',
    'document_comments',
    'document_access_grants',
    'document_correspondents',
    'contract_details',
    'document_links'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_stamp_org ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_stamp_org BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.stamp_organization_from_document()',
      t, t
    );
  END LOOP;
END $do$;

-- Sidecars: stamp_document_sidecar_organization only.
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'document_registration',
    'document_classification',
    'document_archive',
    'document_lifecycle'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_org ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_set_org BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.stamp_document_sidecar_organization()',
      t, t
    );
  END LOOP;
END $do$;

REVOKE EXECUTE ON FUNCTION public.stamp_organization_from_document() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stamp_document_sidecar_organization() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_organization_from_document() TO service_role;
GRANT EXECUTE ON FUNCTION public.stamp_document_sidecar_organization() TO service_role;

NOTIFY pgrst, 'reload schema';
