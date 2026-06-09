import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import {
  AlertCircle,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  LogIn,
  RefreshCw,
  Send,
  Unlink,
} from "lucide-react";
import { requestPasswordResetTelegram } from "@/lib/api/telegram-auth.functions";
import { createTelegramLink, unlinkTelegramAccount } from "@/lib/api/telegram.functions";
import { isTelegramProfileAvailable } from "../constants";
import type { useProfileTelegramData } from "../hooks/useProfileTelegramData";
import type { UserProfile } from "../types";

interface Props {
  profile: UserProfile;
  telegram: ReturnType<typeof useProfileTelegramData>;
}

export function TelegramAccountCard({ profile, telegram }: Props) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const mountedRef = useRef(false);
  const [pendingLink, setPendingLink] = useState<{
    token: string;
    deep_link: string | null;
  } | null>(null);

  const {
    authConfig,
    authLoading,
    linkStatus,
    linkStatusRaw,
    linkStatusLoading,
    linkStatusError,
    linkStatusErrorObj,
    refetchLinkStatus,
  } = telegram;

  const telegramAvailable = isTelegramProfileAvailable(authConfig);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (linkStatus.linked) setPendingLink(null);
  }, [linkStatus.linked]);

  const linkMutation = useMutation({
    mutationFn: () => createTelegramLink(),
    onSuccess: (data) => {
      if (!mountedRef.current) return;
      setPendingLink({ token: data.token, deep_link: data.deep_link });
      void qc.invalidateQueries({ queryKey: ["telegram-link-status"] });
      if (data.deep_link) {
        window.open(data.deep_link, "_blank", "noopener,noreferrer");
        toast.success(t("telegram.link.openBot"));
      } else {
        toast.success(t("telegram.link.tokenReady"));
      }
      void navigator.clipboard.writeText(`/start ${data.token}`).catch(() => {});
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("telegram.link.error")),
  });

  const unlinkMutation = useMutation({
    mutationFn: () => unlinkTelegramAccount(),
    onSuccess: () => {
      if (!mountedRef.current) return;
      void qc.invalidateQueries({ queryKey: ["telegram-link-status"] });
      void qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success(t("telegram.link.unlinked"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("telegram.link.error")),
  });

  const resetMutation = useMutation({
    mutationFn: () => requestPasswordResetTelegram({ data: { email: profile.email } }),
    onSuccess: (result) => {
      if (!mountedRef.current) return;
      if (result.sent) {
        toast.success(t("auth.telegram.resetCodeSent"));
      } else {
        toast.message(t("auth.telegram.resetIfLinked"));
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("auth.telegram.resetError")),
  });

  if (authLoading) {
    return (
      <Card className="rounded-sm">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="w-4 h-4" />
            {t("profile.telegram.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!telegramAvailable) {
    return (
      <Card className="rounded-sm border-dashed">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="w-4 h-4" />
            {t("telegram.link.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("profile.telegram.unavailable")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Send className="w-4 h-4" />
          {t("profile.telegram.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("profile.telegram.description")}</p>

        {linkStatusError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {linkStatusErrorObj instanceof Error
                  ? linkStatusErrorObj.message
                  : t("profile.telegram.loadError")}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => refetchLinkStatus()}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                {t("common.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {linkStatusLoading && !linkStatusRaw ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("common.loading")}
          </div>
        ) : linkStatus.linked ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{t("telegram.link.connected")}</Badge>
              {linkStatus.username && <span className="text-sm">@{linkStatus.username}</span>}
              {linkStatus.chat_id && (
                <span className="text-xs text-muted-foreground font-mono">
                  ID: {linkStatus.chat_id}
                </span>
              )}
            </div>

            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {authConfig?.allow_telegram_login && (
                <li className="flex items-center gap-2">
                  <LogIn className="h-3.5 w-3.5 shrink-0" />
                  {t("profile.telegram.featureLogin")}
                </li>
              )}
              {authConfig?.allow_telegram_password_reset && profile.has_password && (
                <li className="flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 shrink-0" />
                  {t("profile.telegram.featureReset")}
                </li>
              )}
              {authConfig?.telegram_notifications_enabled && (
                <li className="flex items-center gap-2">
                  <Send className="h-3.5 w-3.5 shrink-0" />
                  {t("profile.telegram.featureNotify")}
                </li>
              )}
            </ul>

            <div className="flex flex-wrap gap-2">
              {authConfig?.allow_telegram_password_reset && profile.has_password && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resetMutation.isPending}
                  onClick={() => resetMutation.mutate()}
                >
                  {resetMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  {t("profile.telegram.sendResetCode")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={unlinkMutation.isPending}
                onClick={() => unlinkMutation.mutate()}
              >
                <Unlink className="mr-2 h-4 w-4" />
                {t("telegram.link.disconnect")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("telegram.link.notConnected")}</p>
            <Button
              type="button"
              size="sm"
              disabled={linkMutation.isPending}
              onClick={() => linkMutation.mutate()}
            >
              {linkMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              {t("telegram.link.connect")}
            </Button>
            {pendingLink && (
              <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                <p className="text-xs font-medium">{t("profile.telegram.pendingCode")}</p>
                <code className="block text-xs font-mono break-all">
                  /start {pendingLink.token}
                </code>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(`/start ${pendingLink.token}`)
                        .then(() => toast.success(t("profile.telegram.codeCopied")));
                    }}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    {t("profile.telegram.copyCode")}
                  </Button>
                  {pendingLink.deep_link && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(pendingLink.deep_link!, "_blank", "noopener,noreferrer")
                      }
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      {t("auth.telegram.openBot")}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t("profile.telegram.codeExpiry")}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {t("profile.telegram.connectSteps")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
