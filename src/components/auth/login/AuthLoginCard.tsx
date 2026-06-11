import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthBrand } from "@/components/auth/components/AuthBrand";
import { AuthForm } from "@/components/auth/components/AuthForm";
import { ForgotPasswordPanel } from "@/components/auth/components/ForgotPasswordPanel";
import { sapTabListClass, sapTabTriggerClass } from "@/components/auth/styles/sap-tokens";
import { useI18n } from "@/i18n";
import { AuthAlternativeMethods } from "./AuthAlternativeMethods";
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

export function AuthLoginCard(props: AuthLoginCardProps) {
  const {
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
  } = props;

  const { t } = useI18n();
  const [forgotOpen, setForgotOpen] = useState(false);

  const isBootstrapSetup = config.bootstrap_needed;
  const showSignupTab = config.allow_public_signup && !isBootstrapSetup;
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

  const signupTitle =
    config.bootstrap_needed && mode === "signup"
      ? t("auth.bootstrapTitle")
      : t("auth.signUpTitle");

  const formBlock = (formMode: AuthMode) => (
    <>
      <AuthForm
        mode={formMode}
        email={email}
        password={password}
        passwordConfirm={passwordConfirm}
        fullNameRu={fullNameRu}
        fullNameKk={fullNameKk}
        {...tenantFormProps}
        minPasswordLength={config.min_password_length}
        requireStrongPassword={config.require_strong_password}
        loading={loading}
        showForgotPassword={formMode === "signin" && showTelegramReset && !forgotOpen}
        onForgotPassword={() => setForgotOpen(true)}
        onEmailChange={onEmailChange}
        onPasswordChange={onPasswordChange}
        onPasswordConfirmChange={onPasswordConfirmChange}
        onFullNameRuChange={onFullNameRuChange}
        onFullNameKkChange={onFullNameKkChange}
        onSubmit={onSubmit}
      />

      {formMode === "signin" && !forgotOpen && (
        <AuthAlternativeMethods
          mode={formMode}
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
      )}

      {formMode === "signup" && showEds && (
        <AuthAlternativeMethods
          mode={formMode}
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
    </>
  );

  return (
    <div className="w-full">
      <AuthBrand />

      {mode === "signup" && (
        <h1 className="mb-4 text-center text-lg font-semibold text-foreground">
          {signupTitle}
        </h1>
      )}

      {resolvedTenant && (
        <Alert className="mb-4 rounded-lg border-0 bg-muted/80">
          <AlertTitle className="text-sm">{t("auth.tenant.resolvedTitle")}</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            {resolvedTenant.name_ru}
            {resolvedTenant.slug ? ` (${resolvedTenant.slug})` : ""}
          </AlertDescription>
        </Alert>
      )}

      {config.bootstrap_needed && mode === "signup" && (
        <Alert className="mb-4 rounded-lg border-0 bg-muted/80">
          <AlertTitle className="text-sm">{t("auth.bootstrapAlertTitle")}</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            {t("auth.bootstrapAlertDescription")}
          </AlertDescription>
        </Alert>
      )}

      {forgotOpen && showTelegramReset && mode === "signin" ? (
        <>
          <h2 className="mb-4 text-center text-base font-medium text-foreground">
            {t("auth.telegram.resetTitle")}
          </h2>
          <ForgotPasswordPanel
            minPasswordLength={config.min_password_length}
            tenantSlug={effectiveTenantSlug}
            onBack={() => setForgotOpen(false)}
          />
        </>
      ) : showSignupTab ? (
        <Tabs value={mode} onValueChange={(v) => onModeChange(v as AuthMode)}>
          <TabsList className={sapTabListClass}>
            <TabsTrigger value="signin" className={sapTabTriggerClass}>
              {t("auth.tabSignIn")}
            </TabsTrigger>
            <TabsTrigger value="signup" className={sapTabTriggerClass}>
              {t("auth.tabSignUp")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-0">
            {formBlock("signin")}
          </TabsContent>

          <TabsContent value="signup" className="mt-0">
            {formBlock("signup")}
          </TabsContent>
        </Tabs>
      ) : (
        formBlock(isBootstrapSetup ? "signup" : "signin")
      )}
    </div>
  );
}
