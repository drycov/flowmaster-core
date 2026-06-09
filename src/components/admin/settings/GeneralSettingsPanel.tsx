import { Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";
import type { SystemSettings } from "@/lib/auth/policy";
import { SettingsSection, type SettingsPatchFn } from "./settings-ui";

export function GeneralSettingsPanel({
  form,
  patch,
}: {
  form: SystemSettings;
  patch: SettingsPatchFn;
}) {
  const { t } = useI18n();

  return (
    <SettingsSection title={t("settings.general.title")} icon={<Globe className="h-4 w-4" />}>
      <div className="mb-6 max-w-lg space-y-1.5">
        <Label>{t("settings.general.appUrl")}</Label>
        <Input
          value={form.general.app_url}
          onChange={(e) => patch("general", "app_url", e.target.value)}
          placeholder="https://edms.company.kz"
        />
        <p className="text-xs text-muted-foreground">{t("settings.general.appUrlHint")}</p>
      </div>
      <div className="max-w-xs space-y-1.5">
        <Label>{t("settings.general.defaultLocale")}</Label>
        <Select
          value={form.general.default_locale}
          onValueChange={(v) => patch("general", "default_locale", v as "ru" | "kk")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ru">{t("settings.general.localeRu")}</SelectItem>
            <SelectItem value="kk">{t("settings.general.localeKk")}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("settings.general.defaultLocaleDesc")}</p>
      </div>
    </SettingsSection>
  );
}
