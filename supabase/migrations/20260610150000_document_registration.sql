-- Reliable document registration number assignment

GRANT USAGE, SELECT ON SEQUENCE public.document_reg_seq TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.next_document_reg_number(_prefix text DEFAULT 'DOC')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := coalesce(nullif(btrim(_prefix), ''), 'DOC');
BEGIN
  RETURN v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.document_reg_seq')::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_document_reg_number(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.documents_before_ins_upd()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := 'DOC';
BEGIN
  IF NEW.reg_number IS NULL OR btrim(NEW.reg_number) = '' THEN
    IF TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND (OLD.reg_number IS NULL OR btrim(OLD.reg_number) = '')) THEN
      SELECT coalesce(nullif(btrim(reg_number_prefix), ''), 'DOC')
        INTO v_prefix
        FROM public.organization
        LIMIT 1;

      NEW.reg_number := public.next_document_reg_number(v_prefix);
    END IF;
  END IF;

  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.reg_number, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.title_ru, '') || ' ' || coalesce(NEW.title_kk, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.body, '')), 'C');

  RETURN NEW;
END;
$$;
