-- Add platform_admin to app_role enum (must be committed before use in next migration)

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_admin';

NOTIFY pgrst, 'reload schema';
