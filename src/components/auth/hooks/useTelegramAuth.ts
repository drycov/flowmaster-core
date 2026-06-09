import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { completeTelegramLogin, startTelegramLogin } from "@/lib/api/telegram-auth.functions";
import { setSession } from "@/lib/auth/session-storage";
import { resetSupabaseClient } from "@/integrations/supabase/client";

export function useTelegramAuth(tenantSlug?: string) {
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const { t } = useI18n();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const beginLogin = async () => {
    setLoading(true);
    try {
      const session = await startTelegramLogin();
      setLoginToken(session.token);
      setDeepLink(session.deep_link);
      if (session.deep_link) {
        window.open(session.deep_link, "_blank", "noopener,noreferrer");
      }
      setPolling(true);

      pollRef.current = setInterval(async () => {
        try {
          const result = await completeTelegramLogin({
            data: {
              token: session.token,
              tenant_slug: tenantSlug?.trim() || undefined,
            },
          });
          if (result.status === "ok" && result.access_token && result.user) {
            stopPolling();
            setSession(result.access_token, result.user, result.access_expires_in);
            resetSupabaseClient();
            toast.success(t("auth.telegram.loginSuccess"));
            navigate({ to: "/dashboard" });
          } else if (result.status === "expired") {
            stopPolling();
            toast.error(t("auth.telegram.loginExpired"));
          }
        } catch {
          /* keep polling */
        }
      }, 2000);

      setTimeout(() => {
        stopPolling();
      }, 5 * 60 * 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("auth.telegram.loginError"));
    } finally {
      setLoading(false);
    }
  };

  const cancelLogin = () => {
    stopPolling();
    setLoginToken(null);
    setDeepLink(null);
  };

  return {
    loading,
    polling,
    loginToken,
    deepLink,
    beginLogin,
    cancelLogin,
  };
}
