import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import { AlertCircle, Bell, Loader2, Mail, RefreshCw, Send } from "lucide-react";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/api/notification-preferences.functions";
import { DEFAULT_NOTIFICATION_PREFS } from "../constants";

type PrefKey = string;

type LinkStatus =
  | {
      linked: boolean;
    }
  | null
  | undefined;

interface Props {
  linkStatus?: LinkStatus;
}

export function NotificationChannelsCard({ linkStatus }: Props) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const {
    data: prefs,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
    retry: 1,
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, boolean>) => updateNotificationPreferences({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success(t("profile.notifications.saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("profile.notifications.error")),
  });

  const resolvedPrefs = { ...DEFAULT_NOTIFICATION_PREFS, ...prefs };
  const emailMaster = resolvedPrefs.email_enabled !== false;
  const telegramMaster = resolvedPrefs.telegram_enabled !== false;

  const emailItems: Array<{ key: PrefKey; label: string; master?: boolean }> = [
    { key: "email_enabled", label: t("email.prefs.enabled"), master: true },
    { key: "email_task_assigned", label: t("email.prefs.taskAssigned") },
    { key: "email_workflow_events", label: t("email.prefs.workflowEvents") },
    { key: "email_document_returned", label: t("email.prefs.documentReturned") },
    { key: "email_hr_events", label: t("email.prefs.hrEvents") },
  ];

  const telegramItems: Array<{ key: PrefKey; label: string; master?: boolean }> = [
    { key: "telegram_enabled", label: t("telegram.prefs.enabled"), master: true },
    { key: "telegram_task_assigned", label: t("telegram.prefs.taskAssigned") },
    { key: "telegram_workflow_events", label: t("telegram.prefs.workflowEvents") },
    { key: "telegram_document_returned", label: t("telegram.prefs.documentReturned") },
    { key: "telegram_hr_events", label: t("telegram.prefs.hrEvents") },
  ];

  const renderSwitches = (
    items: typeof emailItems,
    masterOn: boolean,
    prefix: string,
    disabled: boolean,
  ) =>
    items.map((item) => (
      <div key={item.key} className="flex items-center justify-between gap-3">
        <Label htmlFor={`${prefix}-${item.key}`} className="text-sm font-normal">
          {item.label}
        </Label>
        <Switch
          id={`${prefix}-${item.key}`}
          checked={(resolvedPrefs as unknown as Record<string, boolean | undefined>)[item.key] !== false}
          disabled={disabled || save.isPending || (!masterOn && !item.master)}
          onCheckedChange={(v) => save.mutate({ [item.key]: v })}
        />
      </div>
    ));

  const switchesDisabled = isPending && !prefs;

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="w-4 h-4" />
          {t("profile.notifications.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">{t("profile.notifications.hint")}</p>

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {error instanceof Error ? error.message : t("profile.notifications.error")}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                {t("common.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isPending && !prefs && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("common.loading")}
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-medium flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            {t("email.prefs.title")}
          </p>
          {renderSwitches(emailItems, emailMaster, "email", switchesDisabled)}
        </div>

        {linkStatus?.linked ? (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" />
                {t("telegram.prefs.title")}
              </p>
              {renderSwitches(telegramItems, telegramMaster, "tg", switchesDisabled)}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("profile.notifications.telegramLocked")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
