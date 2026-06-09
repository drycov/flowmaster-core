import { useState } from "react";
import { LockKeyhole, Rocket, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthForm } from "./AuthForm";
import { ForgotPasswordPanel } from "./ForgotPasswordPanel";
import { LdapLoginForm } from "./LdapLoginForm";
import { TelegramLoginPanel } from "./TelegramLoginPanel";
import type { AuthMode, PublicAuthConfig } from "../types";

interface AuthRightPanelProps {
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

export function AuthRightPanel({
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
}: AuthRightPanelProps) {
  const { t } = useI18n();
  const [forgotOpen, setForgotOpen] = useState(false);
  const showSignupTab = config.allow_public_signup;
  const showEds = mode === "signin" || config.allow_eds_signup;
  const showLdap = mode === "signin" && config.allow_ldap_login && onLdapAuth;
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

  return (
    <div className="relative flex flex-1 items-center justify-center bg-background px-6 py-10 sm:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,hsl(var(--muted)/0.35))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px]" />

      <div className="relative w-full max-w-[440px]">
        <div className="mb-6 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
              {t("shell.brandAbbr")}
            </div>
            <div>
              <div className="font-semibold">{t("app.name")}</div>
              <div className="text-xs text-muted-foreground">{t("app.tagline")}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("auth.secureAccess")}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {config.bootstrap_needed && mode === "signup"
                ? t("auth.bootstrapTitle")
                : mode === "signin"
                  ? t("auth.signInTitle")
                  : t("auth.signUpTitle")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {config.bootstrap_needed && mode === "signup"
                ? t("auth.bootstrapDescription")
                : t("auth.pageDescription")}
            </p>
          </div>

          {resolvedTenant && (
            <Alert className="mb-5">
              <AlertTitle>{t("auth.tenant.resolvedTitle")}</AlertTitle>
              <AlertDescription>
                {resolvedTenant.name_ru}
                {resolvedTenant.slug ? ` (${resolvedTenant.slug})` : ""}
              </AlertDescription>
            </Alert>
          )}

          {config.bootstrap_needed && mode === "signup" && (
            <Alert className="mb-5 border-primary/20 bg-primary/5">
              <Rocket className="h-4 w-4" />
              <AlertTitle>{t("auth.bootstrapAlertTitle")}</AlertTitle>
              <AlertDescription>{t("auth.bootstrapAlertDescription")}</AlertDescription>
            </Alert>
          )}

          <Tabs
            value={mode}
            onValueChange={(v) => onModeChange(v as AuthMode)}
            className="space-y-5"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t("auth.tabSignIn")}</TabsTrigger>
              <TabsTrigger value="signup" disabled={!showSignupTab}>
                {t("auth.tabSignUp")}
              </TabsTrigger>
            </TabsList>

            {!showSignupTab && (
              <p className="text-xs text-muted-foreground">{t("auth.signupDisabledHint")}</p>
            )}

            <TabsContent value="signin" className="mt-0 space-y-5">
              {forgotOpen && showTelegramReset ? (
                <>
                  <h2 className="text-lg font-medium">{t("auth.telegram.resetTitle")}</h2>
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
                  {showTelegramLogin && (
                    <div className="space-y-3 border-t pt-5">
                      <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("auth.telegram.divider")}
                      </p>
                      <TelegramLoginPanel tenantSlug={effectiveTenantSlug} />
                      <p className="text-center text-xs text-muted-foreground">
                        {t("auth.telegram.loginHint")}
                      </p>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="signup" className="mt-0 space-y-5">
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
            </TabsContent>
          </Tabs>

          {showLdap && (
            <div className="mt-6 space-y-3 border-t pt-5">
              <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("auth.ldapDivider")}
              </p>
              <LdapLoginForm
                loading={loading || ldapLoading}
                tenantSlug={effectiveTenantSlug}
                showTenantSlug={showTenantSlug}
                tenantSlugReadOnly={tenantSlugReadOnly}
                tenantBaseDomain={config.tenant_base_domain}
                onTenantSlugChange={onTenantSlugChange}
                onSubmit={onLdapAuth}
              />
            </div>
          )}

          {showEds && (
            <div className="mt-6 space-y-3 border-t pt-5">
              <button
                type="button"
                disabled={loading || edsLoading}
                onClick={onEdsAuth}
                className="flex w-full items-center justify-center gap-2 rounded-md border bg-background py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                <LockKeyhole className="h-4 w-4" />
                {mode === "signup" ? t("auth.edsSignUp") : t("auth.edsSignIn")}
              </button>
              {email && password && (
                <p className="text-center text-xs text-muted-foreground">{t("auth.edsLinkHint")}</p>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">{t("auth.policyFooter")}</p>
      </div>
    </div>
  );
}
