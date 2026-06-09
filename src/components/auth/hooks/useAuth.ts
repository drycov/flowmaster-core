import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { loginWithEmail, registerWithEmail } from "@/lib/api/auth.functions";
import { setSession } from "@/lib/auth/session-storage";
import { resetSupabaseClient } from "@/integrations/supabase/client";
import { parseServerValidationError } from "../validation";

interface UseAuthReturn {
  loading: boolean;
  signIn: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    fullNameRu: string;
    fullNameKk: string;
    locale: string;
    bootstrap: boolean;
    tenantSlug?: string;
    orgNameRu?: string;
    orgNameKk?: string;
  }) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  const signIn = async (email: string, password: string, tenantSlug?: string) => {
    setLoading(true);
    try {
      const result = await loginWithEmail({
        data: {
          email,
          password,
          tenant_slug: tenantSlug?.trim() || undefined,
        },
      });
      setSession(result.access_token, result.user, result.access_expires_in);
      resetSupabaseClient();
      toast.success(t("auth.toast.signInSuccessFull"));
      navigate({ to: "/dashboard" });
    } catch (err) {
      const fallback = t("auth.toast.signInError");
      const message =
        err instanceof Error
          ? (parseServerValidationError(err.message, t) ?? err.message)
          : fallback;
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (input: {
    email: string;
    password: string;
    fullNameRu: string;
    fullNameKk: string;
    locale: string;
    bootstrap: boolean;
    tenantSlug?: string;
    orgNameRu?: string;
    orgNameKk?: string;
  }) => {
    setLoading(true);
    try {
      const result = await registerWithEmail({
        data: {
          email: input.email,
          password: input.password,
          full_name_ru: input.fullNameRu,
          full_name_kk: input.fullNameKk,
          locale: input.locale as "ru" | "kk",
          tenant_slug: input.tenantSlug?.trim() || undefined,
          org_name_ru: input.orgNameRu?.trim() || undefined,
          org_name_kk: input.orgNameKk?.trim() || undefined,
        },
      });
      setSession(result.access_token, result.user, result.access_expires_in);
      resetSupabaseClient();
      toast.success(
        input.bootstrap ? t("auth.toast.signUpBootstrap") : t("auth.toast.signUpSuccess"),
      );
      navigate({ to: "/dashboard" });
    } catch (err) {
      const fallback = t("auth.toast.signUpError");
      const message =
        err instanceof Error
          ? (parseServerValidationError(err.message, t) ?? err.message)
          : fallback;
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, signIn, signUp };
}
