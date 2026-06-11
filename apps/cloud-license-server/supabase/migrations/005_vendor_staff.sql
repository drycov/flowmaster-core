-- Vendor staff accounts for Cloud Admin (/admin). Separate from portal_accounts (clients).

CREATE TABLE IF NOT EXISTS public.vendor_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff')),
  telegram_chat_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_by uuid REFERENCES public.vendor_staff(id) ON DELETE SET NULL,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_staff_status ON public.vendor_staff(status);
CREATE INDEX IF NOT EXISTS idx_vendor_staff_user_id ON public.vendor_staff(user_id);

GRANT ALL ON public.vendor_staff TO service_role;

ALTER TABLE public.vendor_staff ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS vendor_staff_updated ON public.vendor_staff;
CREATE TRIGGER vendor_staff_updated
  BEFORE UPDATE ON public.vendor_staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
