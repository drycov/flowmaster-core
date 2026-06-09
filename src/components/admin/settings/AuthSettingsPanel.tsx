import { KeyRound, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export function AuthSettingsPanel({
  form,
  meta,
  patch,
  domainDraft,
  onDomainDraftChange,
  onAddDomain,
  onRemoveDomain,
}: {
  form: SystemSettings;
  meta: SystemSettingsMeta;
  patch: SettingsPatchFn;
  domainDraft: string;
  onDomainDraftChange: (value: string) => void;
  onAddDomain: () => void;
  onRemoveDomain: (domain: string) => void;
}) {
  const { t } = useI18n();

  return (
    <SettingsSection title={t("settings.auth.title")} icon={<KeyRound className="h-4 w-4" />}>
      <SettingRow
        label={t("settings.auth.allowPublicSignup")}
        description={t("settings.auth.allowPublicSignupDesc")}
      >
        <Switch
          checked={form.auth.allow_public_signup}
          onCheckedChange={(v) => patch("auth", "allow_public_signup", v)}
          disabled={meta.bootstrap_needed}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.auth.allowEdsSignup")}
        description={t("settings.auth.allowEdsSignupDesc")}
      >
        <Switch
          checked={form.auth.allow_eds_signup}
          onCheckedChange={(v) => patch("auth", "allow_eds_signup", v)}
          disabled={meta.bootstrap_needed}
        />
      </SettingRow>

      <SettingRow
        label={t("settings.auth.requireStrongPassword")}
        description={t("settings.auth.requireStrongPasswordDesc")}
      >
        <Switch
          checked={form.auth.require_strong_password}
          onCheckedChange={(v) => patch("auth", "require_strong_password", v)}
        />
      </SettingRow>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("settings.auth.minPasswordLength")}</Label>
          <Input
            type="number"
            min={8}
            max={128}
            value={form.auth.min_password_length}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) patch("auth", "min_password_length", n);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings.auth.sessionTtl")}</Label>
          <Select
            value={String(form.auth.session_ttl_hours)}
            onValueChange={(v) => patch("auth", "session_ttl_hours", Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="8">{t("settings.auth.session8h")}</SelectItem>
              <SelectItem value="24">{t("settings.auth.session24h")}</SelectItem>
              <SelectItem value="72">{t("settings.auth.session72h")}</SelectItem>
              <SelectItem value="168">{t("settings.auth.session168h")}</SelectItem>
              <SelectItem value="720">{t("settings.auth.session720h")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("settings.auth.sessionTtlHint")}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("settings.auth.allowedDomains")}</Label>
        <div className="flex gap-2">
          <Input
            value={domainDraft}
            onChange={(e) => onDomainDraftChange(e.target.value)}
            placeholder={t("settings.auth.domainPlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddDomain();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={onAddDomain}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {form.auth.allowed_email_domains.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {form.auth.allowed_email_domains.map((domain) => (
              <Badge key={domain} variant="secondary" className="gap-1 pr-1">
                @{domain}
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-muted"
                  onClick={() => onRemoveDomain(domain)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("settings.auth.allowedDomainsHint")}</p>
        )}
      </div>
    </SettingsSection>
  );
}
