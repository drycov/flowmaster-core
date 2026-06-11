import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { loginWithEmail, registerWithEmail } from "@/lib/api/auth.functions";
import { setSession } from "@/lib/auth/session-storage";
import { resetSupabaseClient } from "@/integrations/supabase/client";
import { parseServerValidationError } from "../validation";

function isAuthNetworkError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed");
}

function resolveAuthErrorMessage(
  err: unknown,
  t: (key: string) => string,
  fallbackKey: "auth.toast.signInError" | "auth.toast.signUpError",
): string {
  if (isAuthNetworkError(err)) return t("auth.toast.serverUnavailable");
  const fallback = t(fallbackKey);
  if (err instanceof Error) {
    return parseServerValidationError(err.message, t) ?? err.message;
  }
  return fallback;
}

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
      toast.error(resolveAuthErrorMessage(err, t, "auth.toast.signInError"));
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
      toast.error(resolveAuthErrorMessage(err, t, "auth.toast.signUpError"));
    } finally {
      setLoading(false);
    }
  };

  return { loading, signIn, signUp };
}
