import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { loginWithLdap } from "@/lib/api/auth.functions";
import { setSession } from "@/lib/auth/session-storage";
import { resetSupabaseClient } from "@/integrations/supabase/client";

export function useLdapAuth() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  const signInWithLdap = async (username: string, password: string, tenantSlug?: string) => {
    setLoading(true);
    try {
      const result = await loginWithLdap({
        data: {
          username,
          password,
          tenant_slug: tenantSlug?.trim() || undefined,
        },
      });
      setSession(result.access_token, result.user, result.access_expires_in);
      resetSupabaseClient();
      toast.success(t("auth.toast.ldapSignInSuccess"));
      navigate({ to: "/dashboard" });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.toast.ldapSignInError");
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, signInWithLdap };
}
