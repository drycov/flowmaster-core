import type { UseMutationResult } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import type { SystemSettings, SystemSettingsMeta } from "@/lib/auth/policy";
import { SettingRow, SettingsSection, type SettingsPatchFn } from "./settings-ui";

type TelegramWebhookInfo = {
  webhook_url?: string | null;
  mode?: string | null;
};

export function TelegramSettingsPanel({
  form,
  meta,
  patch,
  telegramWebhook,
  testTelegramMutation,
  registerWebhookMutation,
}: {
  form: SystemSettings;
  meta: SystemSettingsMeta;
  patch: SettingsPatchFn;
  telegramWebhook?: TelegramWebhookInfo;
  testTelegramMutation: UseMutationResult<unknown, Error, void>;
  registerWebhookMutation: UseMutationResult<unknown, Error, void>;
}) {
  const { t } = useI18n();

  return (
    <SettingsSection title={t("settings.telegram.title")} icon={<Send className="h-4 w-4" />}>
      <SettingRow
        label={t("settings.telegram.enabled")}
        description={t("settings.telegram.enabledDesc")}
      >
        <Switch
          checked={form.telegram.enabled}
          onCheckedChange={(v) => patch("telegram", "enabled", v)}
        />
      </SettingRow>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("settings.telegram.botToken")}</Label>
          <Input
            type="password"
            value={form.telegram.bot_token}
            onChange={(e) => patch("telegram", "bot_token", e.target.value)}
            placeholder={meta.has_telegram_bot_token ? t("settings.secretSaved") : "123456:ABC..."}
          />
          <p className="text-xs text-muted-foreground">{t("settings.telegram.botTokenHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings.telegram.chatId")}</Label>
          <Input
            value={form.telegram.default_chat_id}
            onChange={(e) => patch("telegram", "default_chat_id", e.target.value)}
            placeholder="-1001234567890"
          />
        </div>
      </div>

      <SettingRow
        label={t("settings.telegram.allowLogin")}
        description={t("settings.telegram.allowLoginDesc")}
      >
        <Switch
          checked={form.telegram.allow_telegram_login}
          onCheckedChange={(v) => patch("telegram", "allow_telegram_login", v)}
        />
      </SettingRow>
      <SettingRow
        label={t("settings.telegram.allowPasswordReset")}
        description={t("settings.telegram.allowPasswordResetDesc")}
      >
        <Switch
          checked={form.telegram.allow_telegram_password_reset}
          onCheckedChange={(v) => patch("telegram", "allow_telegram_password_reset", v)}
        />
      </SettingRow>
      <SettingRow
        label={t("settings.telegram.notifyTasks")}
        description={t("settings.telegram.notifyTasksDesc")}
      >
        <Switch
          checked={form.telegram.notify_on_tasks}
          onCheckedChange={(v) => patch("telegram", "notify_on_tasks", v)}
        />
      </SettingRow>
      <SettingRow
        label={t("settings.telegram.notifyApprovals")}
        description={t("settings.telegram.notifyApprovalsDesc")}
      >
        <Switch
          checked={form.telegram.notify_on_approvals}
          onCheckedChange={(v) => patch("telegram", "notify_on_approvals", v)}
        />
      </SettingRow>

      <div className="space-y-2 rounded-md border bg-muted/30 p-3">
        <p className="text-xs font-medium">{t("settings.telegram.webhookTitle")}</p>
        <p className="break-all font-mono text-xs text-muted-foreground">
          {telegramWebhook?.webhook_url ?? t("settings.telegram.webhookMissingAppUrl")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {telegramWebhook?.mode === "webhook" ? (
            <Badge variant="secondary">{t("settings.telegram.webhookActive")}</Badge>
          ) : telegramWebhook?.mode === "polling" ? (
            <Badge variant="secondary">{t("settings.telegram.pollingActive")}</Badge>
          ) : (
            <Badge variant="outline">{t("settings.telegram.botOff")}</Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={registerWebhookMutation.isPending || !telegramWebhook?.webhook_url}
            onClick={() => registerWebhookMutation.mutate()}
          >
            {registerWebhookMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("settings.telegram.webhookRegister")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {telegramWebhook?.mode === "polling"
            ? t("settings.telegram.pollingHint")
            : t("settings.telegram.webhookHint")}
        </p>
        {form.telegram.enabled && meta.has_telegram_bot_token && !meta.has_telegram_webhook ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("settings.telegram.webhookSecretWarning")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={testTelegramMutation.isPending}
          onClick={() => testTelegramMutation.mutate()}
        >
          {testTelegramMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {t("settings.telegram.testSend")}
        </Button>
      </div>
    </SettingsSection>
  );
}
