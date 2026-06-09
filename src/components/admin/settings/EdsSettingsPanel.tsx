import { FileSignature } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import type { SystemSettings } from "@/lib/auth/policy";
import { SettingRow, SettingsSection, type SettingsPatchFn } from "./settings-ui";

export function EdsSettingsPanel({
  form,
  patch,
}: {
  form: SystemSettings;
  patch: SettingsPatchFn;
}) {
  const { t } = useI18n();

  return (
    <SettingsSection title={t("settings.eds.title")} icon={<FileSignature className="h-4 w-4" />}>
      <SettingRow
        label={t("settings.eds.requireIinMatch")}
        description={t("settings.eds.requireIinMatchDesc")}
      >
        <Switch
          checked={form.eds.require_iin_match}
          onCheckedChange={(v) => patch("eds", "require_iin_match", v)}
        />
      </SettingRow>
      <SettingRow
        label={t("settings.eds.requireCertValid")}
        description={t("settings.eds.requireCertValidDesc")}
      >
        <Switch
          checked={form.eds.require_cert_valid}
          onCheckedChange={(v) => patch("eds", "require_cert_valid", v)}
        />
      </SettingRow>
      <SettingRow
        label={t("settings.eds.allowOrgCertificate")}
        description={t("settings.eds.allowOrgCertificateDesc")}
      >
        <Switch
          checked={form.eds.allow_org_certificate}
          onCheckedChange={(v) => patch("eds", "allow_org_certificate", v)}
        />
      </SettingRow>
    </SettingsSection>
  );
}
