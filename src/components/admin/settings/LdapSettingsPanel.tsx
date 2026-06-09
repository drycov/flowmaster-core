import type { UseMutationResult } from "@tanstack/react-query";
import { Building2, Loader2, RefreshCw } from "lucide-react";
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
import { roleLabel } from "@/i18n/helpers";
import type { SystemSettings, SystemSettingsMeta } from "@/lib/auth/policy";
import { APP_ROLES } from "@/lib/auth/roles";
import { SettingRow, SettingsSection, type SettingsPatchFn } from "./settings-ui";

export function LdapSettingsPanel({
  form,
  meta,
  patch,
  testLdapMutation,
}: {
  form: SystemSettings;
  meta: SystemSettingsMeta;
  patch: SettingsPatchFn;
  testLdapMutation: UseMutationResult<unknown, Error, SystemSettings["ldap"]>;
}) {
  const { t } = useI18n();

  return (
    <SettingsSection title={t("settings.ldap.title")} icon={<Building2 className="h-4 w-4" />}>
      <SettingRow label={t("settings.ldap.enabled")} description={t("settings.ldap.enabledDesc")}>
        <Switch
          checked={form.ldap.enabled}
          onCheckedChange={(v) => patch("ldap", "enabled", v)}
          disabled={meta.bootstrap_needed}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.ldap.autoProvision")}
        description={t("settings.ldap.autoProvisionDesc")}
      >
        <Switch
          checked={form.ldap.auto_provision}
          onCheckedChange={(v) => patch("ldap", "auto_provision", v)}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.ldap.rejectUnauthorized")}
        description={t("settings.ldap.rejectUnauthorizedDesc")}
      >
        <Switch
          checked={form.ldap.reject_unauthorized}
          onCheckedChange={(v) => patch("ldap", "reject_unauthorized", v)}
        />
      </SettingRow>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("settings.ldap.url")}</Label>
          <Input
            value={form.ldap.url}
            onChange={(e) => patch("ldap", "url", e.target.value)}
            placeholder="ldaps://dc.corp.local:636"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("settings.ldap.baseDn")}</Label>
          <Input
            value={form.ldap.base_dn}
            onChange={(e) => patch("ldap", "base_dn", e.target.value)}
            placeholder="DC=corp,DC=local"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("settings.ldap.bindDn")}</Label>
          <Input
            value={form.ldap.bind_dn}
            onChange={(e) => patch("ldap", "bind_dn", e.target.value)}
            placeholder="CN=svc-flowmaster,OU=Service Accounts,DC=corp,DC=local"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("settings.ldap.bindPassword")}</Label>
          <Input
            type="password"
            value={form.ldap.bind_password}
            onChange={(e) => patch("ldap", "bind_password", e.target.value)}
            placeholder={meta.has_ldap_bind_password ? t("settings.secretSaved") : ""}
          />
          <p className="text-xs text-muted-foreground">{t("settings.ldap.bindPasswordHint")}</p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("settings.ldap.userFilter")}</Label>
          <Input
            value={form.ldap.user_filter}
            onChange={(e) => patch("ldap", "user_filter", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("settings.ldap.userFilterHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings.ldap.emailAttr")}</Label>
          <Input
            value={form.ldap.email_attr}
            onChange={(e) => patch("ldap", "email_attr", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings.ldap.displayNameAttr")}</Label>
          <Input
            value={form.ldap.display_name_attr}
            onChange={(e) => patch("ldap", "display_name_attr", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings.ldap.defaultRole")}</Label>
          <Select
            value={form.ldap.default_role}
            onValueChange={(v) => patch("ldap", "default_role", v as typeof form.ldap.default_role)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APP_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {roleLabel(t, role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("settings.ldap.defaultRoleHint")}</p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => testLdapMutation.mutate(form.ldap)}
        disabled={testLdapMutation.isPending}
      >
        {testLdapMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        {t("settings.ldap.testConnection")}
      </Button>
    </SettingsSection>
  );
}
