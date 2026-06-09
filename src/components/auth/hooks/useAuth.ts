import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { loginWithEmail, registerWithEmail } from "@/lib/api/auth.functions";
import { setSession } from "@/lib/auth/session-storage";
import { resetSupabaseClient } from "@/integrations/supabase/client";

interface UseAuthReturn {
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, locale: string) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await loginWithEmail({ data: { email, password } });
      setSession(result.access_token, result.user);
      resetSupabaseClient();
      toast.success(t("auth.toast.signInSuccessFull"));
      navigate({ to: "/dashboard" });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.toast.signInError");
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, locale: string) => {
    setLoading(true);
    try {
      const result = await registerWithEmail({
        data: {
          email,
          password,
          full_name_ru: fullName,
          full_name_kk: fullName,
          locale: locale as "ru" | "kk",
        },
      });
      setSession(result.access_token, result.user);
      resetSupabaseClient();
      toast.success(t("auth.toast.signUpAdmin"));
      navigate({ to: "/dashboard" });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.toast.signUpError");
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, signIn, signUp };
}
