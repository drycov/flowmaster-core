-- Trigger-only SECURITY DEFINER helpers (phase1 tenant hardening).
-- Revoke API-role EXECUTE so PostgREST cannot call them; triggers still fire on INSERT.

REVOKE EXECUTE ON FUNCTION public.stamp_organization_from_document() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stamp_notification_organization() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.stamp_organization_from_document() TO service_role;
GRANT EXECUTE ON FUNCTION public.stamp_notification_organization() TO service_role;

NOTIFY pgrst, 'reload schema';
