import { AlertTriangle, Building2, KeyRound, Mail, Plug, Users } from "lucide-react";
import { useI18n } from "@/i18n";
import type { SystemSettings, SystemSettingsMeta } from "@/lib/auth/policy";
import { QuickLink, StatusCard } from "./settings-ui";

export function OverviewSettingsPanel({
  form,
  meta,
  effectiveSignup,
}: {
  form: SystemSettings;
  meta: SystemSettingsMeta;
  effectiveSignup: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {meta.bootstrap_needed && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">{t("settings.overview.bootstrapTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings.overview.bootstrapDesc")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatusCard
          label={t("settings.overview.publicSignup")}
          enabled={effectiveSignup}
          detail={
            meta.bootstrap_needed
              ? t("settings.overview.bootstrapMode")
              : form.auth.allow_public_signup
                ? t("settings.overview.enabled")
                : t("settings.overview.disabled")
          }
        />
        <StatusCard
          label={t("settings.overview.edsSignup")}
          enabled={meta.bootstrap_needed || form.auth.allow_eds_signup}
          detail={
            form.auth.allow_eds_signup
              ? t("settings.overview.enabled")
              : t("settings.overview.disabled")
          }
        />
        <StatusCard
          label={t("settings.overview.ldapLogin")}
          enabled={!meta.bootstrap_needed && form.ldap.enabled}
          detail={
            form.ldap.enabled ? t("settings.overview.enabled") : t("settings.overview.disabled")
          }
        />
        <StatusCard
          label={t("settings.overview.domains")}
          enabled={form.auth.allowed_email_domains.length > 0}
          detail={
            form.auth.allowed_email_domains.length > 0
              ? t("settings.overview.domainsCount").replace(
                  "{n}",
                  String(form.auth.allowed_email_domains.length),
                )
              : t("settings.overview.domainsAny")
          }
          neutral
        />
        <StatusCard
          label={t("settings.overview.session")}
          enabled
          detail={t("settings.overview.sessionHours").replace(
            "{n}",
            String(form.auth.session_ttl_hours),
          )}
          neutral
        />
        <StatusCard
          label={t("settings.overview.admins")}
          enabled={meta.has_admin}
          detail={String(meta.admin_count)}
          neutral
        />
        <StatusCard
          label={t("settings.overview.defaultLocale")}
          enabled
          detail={form.general.default_locale.toUpperCase()}
          neutral
        />
        <StatusCard
          label={t("settings.overview.mail")}
          enabled={form.mail.enabled && (meta.has_resend_api_key || meta.has_smtp_password)}
          detail={
            form.mail.enabled
              ? form.mail.provider === "smtp"
                ? t("settings.overview.mailSmtp")
                : t("settings.overview.mailResend")
              : t("settings.overview.disabled")
          }
        />
        <StatusCard
          label={t("settings.overview.telegram")}
          enabled={form.telegram.enabled && meta.has_telegram_bot_token}
          detail={
            form.telegram.enabled ? t("settings.overview.enabled") : t("settings.overview.disabled")
          }
        />
        <StatusCard
          label={t("settings.overview.appUrl")}
          enabled={meta.has_app_url}
          detail={meta.has_app_url ? form.general.app_url : t("settings.overview.notConfigured")}
          neutral={!meta.has_app_url}
        />
        <StatusCard
          label={t("settings.overview.office")}
          enabled={form.integrations.office_enabled && meta.has_office_url}
          detail={
            form.integrations.office_enabled
              ? meta.has_office_url
                ? t("settings.overview.enabled")
                : t("settings.overview.notConfigured")
              : t("settings.overview.disabled")
          }
        />
        <StatusCard
          label={t("settings.overview.s3")}
          enabled={meta.has_s3_secret && !!form.integrations.s3_endpoint.trim()}
          detail={
            meta.has_s3_secret
              ? t("settings.overview.enabled")
              : t("settings.overview.notConfigured")
          }
          neutral={!meta.has_s3_secret}
        />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 font-semibold">{t("settings.overview.linksTitle")}</h3>
        <div className="flex flex-wrap gap-2">
          <QuickLink
            to="/admin/users"
            icon={<Users className="h-4 w-4" />}
            label={t("nav.users")}
          />
          <QuickLink
            to="/admin/organization"
            icon={<Building2 className="h-4 w-4" />}
            label={t("nav.organization")}
          />
          <QuickLink
            to="/admin/settings"
            search={{ tab: "license" }}
            icon={<KeyRound className="h-4 w-4" />}
            label={t("nav.license")}
          />
          <QuickLink
            to="/admin/settings"
            search={{ tab: "integrations" }}
            icon={<Plug className="h-4 w-4" />}
            label={t("nav.integrations")}
          />
          <QuickLink
            to="/admin/settings"
            search={{ tab: "mail" }}
            icon={<Mail className="h-4 w-4" />}
            label={t("settings.tab.mail")}
          />
        </div>
      </div>
    </div>
  );
}
