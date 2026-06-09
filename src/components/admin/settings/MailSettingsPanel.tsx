import type { UseMutationResult } from "@tanstack/react-query";
import { Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import type { SystemSettings, SystemSettingsMeta } from "@/lib/auth/policy";
import { SettingRow, SettingsSection, type SettingsPatchFn } from "./settings-ui";

export function MailSettingsPanel({
  form,
  meta,
  patch,
  testMailTo,
  onTestMailToChange,
  testMailMutation,
}: {
  form: SystemSettings;
  meta: SystemSettingsMeta;
  patch: SettingsPatchFn;
  testMailTo: string;
  onTestMailToChange: (value: string) => void;
  testMailMutation: UseMutationResult<unknown, Error, string>;
}) {
  const { t } = useI18n();

  return (
    <SettingsSection title={t("settings.mail.title")} icon={<Mail className="h-4 w-4" />}>
      <SettingRow label={t("settings.mail.enabled")} description={t("settings.mail.enabledDesc")}>
        <Switch checked={form.mail.enabled} onCheckedChange={(v) => patch("mail", "enabled", v)} />
      </SettingRow>

      <div className="max-w-xs space-y-1.5">
        <Label>{t("settings.mail.provider")}</Label>
        <Select
          value={form.mail.provider}
          onValueChange={(v) => patch("mail", "provider", v as "resend" | "smtp")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="resend">Resend API</SelectItem>
            <SelectItem value="smtp">SMTP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("settings.mail.fromName")}</Label>
          <Input
            value={form.mail.from_name}
            onChange={(e) => patch("mail", "from_name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings.mail.fromAddress")}</Label>
          <Input
            type="email"
            value={form.mail.from_address}
            onChange={(e) => patch("mail", "from_address", e.target.value)}
            placeholder="noreply@company.kz"
          />
        </div>
      </div>

      {form.mail.provider === "resend" ? (
        <div className="space-y-1.5">
          <Label>{t("settings.mail.resendApiKey")}</Label>
          <Input
            type="password"
            value={form.mail.resend_api_key}
            onChange={(e) => patch("mail", "resend_api_key", e.target.value)}
            placeholder={meta.has_resend_api_key ? t("settings.secretSaved") : "re_..."}
          />
          <p className="text-xs text-muted-foreground">{t("settings.mail.resendHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("settings.mail.smtpHost")}</Label>
            <Input
              value={form.mail.smtp_host}
              onChange={(e) => patch("mail", "smtp_host", e.target.value)}
              placeholder="smtp.company.kz"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings.mail.smtpPort")}</Label>
            <Input
              type="number"
              value={form.mail.smtp_port}
              onChange={(e) => patch("mail", "smtp_port", Number(e.target.value) || 587)}
            />
          </div>
          <SettingRow
            label={t("settings.mail.smtpSecure")}
            description={t("settings.mail.smtpSecureDesc")}
          >
            <Switch
              checked={form.mail.smtp_secure}
              onCheckedChange={(v) => patch("mail", "smtp_secure", v)}
            />
          </SettingRow>
          <div className="space-y-1.5">
            <Label>{t("settings.mail.smtpUser")}</Label>
            <Input
              value={form.mail.smtp_user}
              onChange={(e) => patch("mail", "smtp_user", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings.mail.smtpPassword")}</Label>
            <Input
              type="password"
              value={form.mail.smtp_password}
              onChange={(e) => patch("mail", "smtp_password", e.target.value)}
              placeholder={meta.has_smtp_password ? t("settings.secretSaved") : ""}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label>{t("settings.mail.testTo")}</Label>
          <Input
            type="email"
            value={testMailTo}
            onChange={(e) => onTestMailToChange(e.target.value)}
            placeholder="admin@company.kz"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!testMailTo.trim() || testMailMutation.isPending}
          onClick={() => testMailMutation.mutate(testMailTo.trim())}
        >
          {testMailMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {t("settings.mail.testSend")}
        </Button>
      </div>
    </SettingsSection>
  );
}
