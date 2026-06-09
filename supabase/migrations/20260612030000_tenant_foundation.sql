-- SaaS foundation: tenant metadata on organization (single-row today, multi-row ready)

ALTER TABLE public.organization
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS tenant_mode text NOT NULL DEFAULT 'single'
    CHECK (tenant_mode IN ('single', 'multi'));

UPDATE public.organization
SET slug = 'default'
WHERE slug IS NULL OR trim(slug) = '';

CREATE UNIQUE INDEX IF NOT EXISTS organization_slug_unique
  ON public.organization (slug)
  WHERE slug IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organization(id) ON DELETE RESTRICT;

UPDATE public.profiles p
SET organization_id = o.id
FROM (SELECT id FROM public.organization ORDER BY created_at LIMIT 1) o
WHERE p.organization_id IS NULL;

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id FROM public.organization o ORDER BY o.created_at LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
