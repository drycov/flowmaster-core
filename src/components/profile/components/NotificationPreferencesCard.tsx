import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/api/notification-preferences.functions";

export function NotificationPreferencesCard() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, boolean>) =>
      updateNotificationPreferences({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success(t("email.prefs.saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("email.prefs.error")),
  });

  const toggle = (key: string, value: boolean) => {
    save.mutate({ [key]: value });
  };

  if (isLoading || !prefs) {
    return null;
  }

  const items = [
    { key: "email_enabled", label: t("email.prefs.enabled"), master: true },
    { key: "email_task_assigned", label: t("email.prefs.taskAssigned") },
    { key: "email_workflow_events", label: t("email.prefs.workflowEvents") },
    { key: "email_document_returned", label: t("email.prefs.documentReturned") },
  ] as const;

  const masterOn = prefs.email_enabled !== false;

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Mail className="w-4 h-4" />
          {t("email.prefs.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("email.prefs.hint")}</p>
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3">
            <Label htmlFor={item.key} className="text-sm font-normal">
              {item.label}
            </Label>
            <Switch
              id={item.key}
              checked={prefs[item.key] !== false}
              disabled={save.isPending || (!masterOn && item.key !== "email_enabled")}
              onCheckedChange={(v) => toggle(item.key, v)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
