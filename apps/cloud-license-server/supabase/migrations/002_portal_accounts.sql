-- Client portal: accounts linked to Supabase Auth users and installations.

CREATE TABLE IF NOT EXISTS public.portal_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  company_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.portal_account_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.portal_accounts(id) ON DELETE CASCADE,
  installation_id text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT 'Основная установка',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_account_installations_account
  ON public.portal_account_installations(account_id);

GRANT ALL ON public.portal_accounts TO service_role;
GRANT ALL ON public.portal_account_installations TO service_role;

ALTER TABLE public.portal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_account_installations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS portal_accounts_updated ON public.portal_accounts;
CREATE TRIGGER portal_accounts_updated
  BEFORE UPDATE ON public.portal_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
