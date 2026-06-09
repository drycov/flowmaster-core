import { Plug } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import type { SystemSettings, SystemSettingsMeta } from "@/lib/auth/policy";
import { IntegrationsSettingsPanel } from "./IntegrationsSettingsPanel";
import { SettingRow, SettingsSection, type SettingsPatchFn } from "./settings-ui";

export function ServicesSettingsPanel({
  form,
  meta,
  patch,
  canManageIntegrations = true,
}: {
  form: SystemSettings;
  meta: SystemSettingsMeta;
  patch: SettingsPatchFn;
  canManageIntegrations?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t("settings.integrations.servicesTitle")}
        icon={<Plug className="h-4 w-4" />}
      >
        <div className="space-y-4">
          <SettingRow
            label={t("settings.integrations.officeEnabled")}
            description={t("settings.integrations.officeEnabledDesc")}
          >
            <Switch
              checked={form.integrations.office_enabled}
              onCheckedChange={(v) => patch("integrations", "office_enabled", v)}
            />
          </SettingRow>
          <div className="space-y-1.5">
            <Label>{t("settings.integrations.officeUrl")}</Label>
            <Input
              value={form.integrations.office_url}
              onChange={(e) => patch("integrations", "office_url", e.target.value)}
              placeholder="https://office.company.kz"
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.integrations.officeUrlHint")}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("settings.integrations.s3Endpoint")}</Label>
              <Input
                value={form.integrations.s3_endpoint}
                onChange={(e) => patch("integrations", "s3_endpoint", e.target.value)}
                placeholder="https://xxx.storage.supabase.co/storage/v1/s3"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.integrations.s3Region")}</Label>
              <Input
                value={form.integrations.s3_region}
                onChange={(e) => patch("integrations", "s3_region", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.integrations.s3AccessKey")}</Label>
              <Input
                value={form.integrations.s3_access_key_id}
                onChange={(e) => patch("integrations", "s3_access_key_id", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("settings.integrations.s3Secret")}</Label>
              <Input
                type="password"
                value={form.integrations.s3_secret_access_key}
                onChange={(e) => patch("integrations", "s3_secret_access_key", e.target.value)}
                placeholder={meta.has_s3_secret ? t("settings.secretSaved") : ""}
              />
              <p className="text-xs text-muted-foreground">{t("settings.integrations.s3Hint")}</p>
            </div>
          </div>
        </div>
      </SettingsSection>
      <IntegrationsSettingsPanel canManage={canManageIntegrations} />
    </div>
  );
}
