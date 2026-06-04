
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.documents_before_ins_upd() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_document(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_documents() FROM anon, authenticated;
