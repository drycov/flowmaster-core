-- Fix app auth RPC visibility for PostgREST + repoint user FKs off auth.users

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Repoint remaining FKs from auth.users → profiles (documents, versions, etc.)
DO $$
DECLARE
  r RECORD;
  col_name TEXT;
  on_delete TEXT;
BEGIN
  FOR r IN
    SELECT
      c.conname,
      c.conrelid::regclass AS child_table,
      c.conkey,
      pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    SELECT a.attname INTO col_name
    FROM pg_attribute a
    WHERE a.attrelid = r.child_table
      AND a.attnum = r.conkey[1];

    on_delete := CASE
      WHEN r.def LIKE '%ON DELETE CASCADE%' THEN 'CASCADE'
      WHEN r.def LIKE '%ON DELETE SET NULL%' THEN 'SET NULL'
      ELSE 'NO ACTION'
    END;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.child_table, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE %s',
      r.child_table, r.conname, col_name, on_delete
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.hash_password(p_password TEXT)
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT extensions.crypt(p_password, extensions.gen_salt('bf'::text, 10));
$$;

CREATE OR REPLACE FUNCTION public.verify_password(p_password TEXT, p_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT p_hash IS NOT NULL AND p_hash = extensions.crypt(p_password, p_hash);
$$;

CREATE OR REPLACE FUNCTION public.authenticate_app_user(
  p_email TEXT,
  p_password TEXT
)
RETURNS TABLE (user_id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
BEGIN
  SELECT p.id, p.email
  INTO v_user_id, v_email
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(p_email))
    AND p.password_hash IS NOT NULL
    AND public.verify_password(p_password, p.password_hash)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Неверный email или пароль';
  END IF;

  RETURN QUERY SELECT v_user_id, v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.hash_password(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_password(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.authenticate_app_user(TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.hash_password(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.authenticate_app_user(TEXT, TEXT) TO service_role;

-- Audit: prefer document owner when JWT sub is unavailable (service-role writes)
CREATE OR REPLACE FUNCTION public.audit_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, entity_type, entity_id, action, before, after)
  VALUES (
    COALESCE(auth.uid(), NEW.created_by, OLD.created_by),
    'document',
    COALESCE(NEW.id::text, OLD.id::text),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

NOTIFY pgrst, 'reload schema';
