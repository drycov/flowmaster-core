import { useState } from "react";
import { Rocket, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthForm } from "@/components/auth/components/AuthForm";
import { ForgotPasswordPanel } from "@/components/auth/components/ForgotPasswordPanel";
import { sap, sapTabListClass, sapTabTriggerClass } from "@/components/auth/styles/sap-tokens";
import { useI18n } from "@/i18n";
import { AuthAlternativeMethods } from "./AuthAlternativeMethods";
import { AuthSecurityBlock } from "./AuthSecurityBlock";
import type { AuthMode, PublicAuthConfig } from "../types";

interface AuthLoginCardProps {
  mode: AuthMode;
  config: PublicAuthConfig;
  email: string;
  password: string;
  passwordConfirm: string;
  fullNameRu: string;
  fullNameKk: string;
  tenantSlug: string;
  orgNameRu: string;
  orgNameKk: string;
  loading: boolean;
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onFullNameRuChange: (value: string) => void;
  onFullNameKkChange: (value: string) => void;
  onTenantSlugChange: (value: string) => void;
  onOrgNameRuChange: (value: string) => void;
  onOrgNameKkChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onEdsAuth: () => void;
  edsLoading?: boolean;
  onLdapAuth?: (username: string, password: string) => Promise<void>;
  ldapLoading?: boolean;
}

export function AuthLoginCard({
  mode,
  config,
  email,
  password,
  passwordConfirm,
  fullNameRu,
  fullNameKk,
  tenantSlug,
  orgNameRu,
  orgNameKk,
  loading,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onPasswordConfirmChange,
  onFullNameRuChange,
  onFullNameKkChange,
  onTenantSlugChange,
  onOrgNameRuChange,
  onOrgNameKkChange,
  onSubmit,
  onEdsAuth,
  edsLoading = false,
  onLdapAuth,
  ldapLoading = false,
}: AuthLoginCardProps) {
  const { t } = useI18n();
  const [forgotOpen, setForgotOpen] = useState(false);

  const showSignupTab = config.allow_public_signup;
  const showEds = mode === "signin" || config.allow_eds_signup;
  const showLdap = mode === "signin" && config.allow_ldap_login && Boolean(onLdapAuth);
  const showTelegramLogin = mode === "signin" && config.allow_telegram_login;
  const showTelegramReset = config.allow_telegram_password_reset;
  const resolvedTenant = config.resolved_tenant;
  const showTenantSlug = config.require_tenant_slug && !resolvedTenant;
  const showBootstrapOrg = config.bootstrap_needed && mode === "signup";
  const tenantSlugReadOnly = Boolean(resolvedTenant?.slug);
  const effectiveTenantSlug = resolvedTenant?.slug ?? tenantSlug;

  const tenantFormProps = {
    tenantSlug: effectiveTenantSlug,
    orgNameRu,
    orgNameKk,
    showTenantSlug,
    showBootstrapOrg,
    tenantSlugReadOnly,
    tenantBaseDomain: config.tenant_base_domain,
    onTenantSlugChange,
    onOrgNameRuChange,
    onOrgNameKkChange,
  };

  const cardTitle =
    config.bootstrap_needed && mode === "signup"
      ? t("auth.bootstrapTitle")
      : mode === "signin"
        ? t("auth.signInTitle")
        : t("auth.signUpTitle");

  const cardDescription =
    config.bootstrap_needed && mode === "signup"
      ? t("auth.bootstrapDescription")
      : t("auth.pageDescription");

  return (
    <div
      className="w-full max-w-[520px] rounded-sm p-6 sm:p-8 xl:max-w-[540px]"
      style={{ backgroundColor: sap.card, boxShadow: sap.shadowCard }}
    >
      <div className="mb-5 space-y-3 border-b pb-5" style={{ borderColor: sap.borderLight }}>
        <div
          className="inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            borderColor: sap.border,
            backgroundColor: sap.messageInfoBg,
            color: sap.link,
          }}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {t("auth.secureAccess")}
        </div>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl" style={{ color: sap.text }}>
            {cardTitle}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: sap.textSecondary }}>
            {cardDescription}
          </p>
        </div>
      </div>

      {resolvedTenant && (
        <Alert
          className="mb-4 rounded-sm border-l-4"
          style={{
            borderLeftColor: sap.brand,
            borderColor: sap.borderLight,
            backgroundColor: sap.messageInfoBg,
          }}
        >
          <AlertTitle style={{ color: sap.text }}>{t("auth.tenant.resolvedTitle")}</AlertTitle>
          <AlertDescription style={{ color: sap.textSecondary }}>
            {resolvedTenant.name_ru}
            {resolvedTenant.slug ? ` (${resolvedTenant.slug})` : ""}
          </AlertDescription>
        </Alert>
      )}

      {config.bootstrap_needed && mode === "signup" && (
        <Alert
          className="mb-4 rounded-sm border-l-4"
          style={{
            borderLeftColor: sap.brand,
            borderColor: sap.borderLight,
            backgroundColor: sap.messageInfoBg,
          }}
        >
          <Rocket className="h-4 w-4" style={{ color: sap.brand }} />
          <AlertTitle style={{ color: sap.text }}>{t("auth.bootstrapAlertTitle")}</AlertTitle>
          <AlertDescription style={{ color: sap.textSecondary }}>
            {t("auth.bootstrapAlertDescription")}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={mode} onValueChange={(v) => onModeChange(v as AuthMode)} className="space-y-4">
        <TabsList className={sapTabListClass}>
          <TabsTrigger value="signin" className={sapTabTriggerClass}>
            {t("auth.tabSignIn")}
          </TabsTrigger>
          <TabsTrigger value="signup" disabled={!showSignupTab} className={sapTabTriggerClass}>
            {t("auth.tabSignUp")}
          </TabsTrigger>
        </TabsList>

        {!showSignupTab && (
          <p className="text-xs" style={{ color: sap.textMuted }}>
            {t("auth.signupDisabledHint")}
          </p>
        )}

        <TabsContent value="signin" className="mt-0 space-y-4">
          {forgotOpen && showTelegramReset ? (
            <>
              <h2 className="text-base font-semibold" style={{ color: sap.text }}>
                {t("auth.telegram.resetTitle")}
              </h2>
              <ForgotPasswordPanel
                minPasswordLength={config.min_password_length}
                tenantSlug={effectiveTenantSlug}
                onBack={() => setForgotOpen(false)}
              />
            </>
          ) : (
            <>
              <AuthForm
                mode="signin"
                email={email}
                password={password}
                passwordConfirm={passwordConfirm}
                fullNameRu={fullNameRu}
                fullNameKk={fullNameKk}
                {...tenantFormProps}
                minPasswordLength={config.min_password_length}
                requireStrongPassword={config.require_strong_password}
                loading={loading}
                showForgotPassword={showTelegramReset}
                onForgotPassword={() => setForgotOpen(true)}
                onEmailChange={onEmailChange}
                onPasswordChange={onPasswordChange}
                onPasswordConfirmChange={onPasswordConfirmChange}
                onFullNameRuChange={onFullNameRuChange}
                onFullNameKkChange={onFullNameKkChange}
                onSubmit={onSubmit}
              />

              <AuthAlternativeMethods
                mode={mode}
                showEds={showEds}
                showTelegram={showTelegramLogin}
                showLdap={showLdap}
                loading={loading}
                edsLoading={edsLoading}
                ldapLoading={ldapLoading}
                tenantSlug={effectiveTenantSlug}
                showTenantSlug={showTenantSlug}
                tenantSlugReadOnly={tenantSlugReadOnly}
                tenantBaseDomain={config.tenant_base_domain}
                onEdsAuth={onEdsAuth}
                onLdapAuth={onLdapAuth}
                onTenantSlugChange={onTenantSlugChange}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="signup" className="mt-0 space-y-4">
          <AuthForm
            mode="signup"
            email={email}
            password={password}
            passwordConfirm={passwordConfirm}
            fullNameRu={fullNameRu}
            fullNameKk={fullNameKk}
            {...tenantFormProps}
            minPasswordLength={config.min_password_length}
            requireStrongPassword={config.require_strong_password}
            loading={loading}
            onEmailChange={onEmailChange}
            onPasswordChange={onPasswordChange}
            onPasswordConfirmChange={onPasswordConfirmChange}
            onFullNameRuChange={onFullNameRuChange}
            onFullNameKkChange={onFullNameKkChange}
            onSubmit={onSubmit}
          />

          {showEds && (
            <AuthAlternativeMethods
              mode={mode}
              showEds={showEds}
              showTelegram={false}
              showLdap={false}
              loading={loading}
              edsLoading={edsLoading}
              ldapLoading={ldapLoading}
              tenantSlug={effectiveTenantSlug}
              showTenantSlug={showTenantSlug}
              tenantSlugReadOnly={tenantSlugReadOnly}
              tenantBaseDomain={config.tenant_base_domain}
              onEdsAuth={onEdsAuth}
              onTenantSlugChange={onTenantSlugChange}
            />
          )}
        </TabsContent>
      </Tabs>

      {email && password && showEds && mode === "signin" && !forgotOpen && (
        <p className="mt-3 text-center text-xs" style={{ color: sap.textMuted }}>
          {t("auth.edsLinkHint")}
        </p>
      )}

      <div className="mt-5">
        <AuthSecurityBlock />
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed" style={{ color: sap.textMuted }}>
        {t("auth.policyFooter")}
      </p>
    </div>
  );
}
