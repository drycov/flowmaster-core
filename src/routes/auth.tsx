import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useAuth } from "@/components/auth/hooks/useAuth";
import { useEdsAuth } from "@/components/auth/hooks/useEdsAuth";
import { useLdapAuth } from "@/components/auth/hooks/useLdapAuth";
import { useAuthForm } from "@/components/auth/hooks/useAuthForm";
import { AuthLeftPanel } from "@/components/auth/components/AuthLeftPanel";
import { LanguageSwitcher } from "@/components/auth/components/LanguageSwitcher";
import { AuthRightPanel } from "@/components/auth/components/AuthRightPanel";
import { getPublicAuthConfigFn } from "@/lib/api/system.functions";
import type { PublicAuthConfig } from "@/components/auth/types";
import {
  formatAuthValidationIssues,
  resolveEdsLinkCredentials,
  signInInputSchema,
  signUpInputSchema,
} from "@/components/auth/validation";

const DEFAULT_CONFIG: PublicAuthConfig = {
  bootstrap_needed: false,
  allow_public_signup: false,
  allow_eds_signup: true,
  allow_ldap_login: false,
  telegram_bot_configured: false,
  telegram_notifications_enabled: false,
  allow_telegram_login: false,
  allow_telegram_password_reset: false,
  min_password_length: 8,
  require_strong_password: false,
  multi_tenant: false,
  organization_count: 0,
  resolved_tenant: null,
  require_tenant_slug: false,
  tenant_base_domain: null,
};

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход — ЕСЭДО" },
      { name: "description", content: "Вход в единую систему электронного документооборота." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, locale } = useI18n();
  const { loading, signIn, signUp } = useAuth();
  const { loading: edsLoading, signInWithEds } = useEdsAuth();
  const { loading: ldapLoading, signInWithLdap } = useLdapAuth();
  const { data: config = DEFAULT_CONFIG } = useQuery({
    queryKey: ["public-auth-config"],
    queryFn: getPublicAuthConfigFn,
    staleTime: 60_000,
  });

  const {
    mode,
    email,
    password,
    passwordConfirm,
    fullNameRu,
    fullNameKk,
    tenantSlug,
    orgNameRu,
    orgNameKk,
    setMode,
    setEmail,
    setPassword,
    setPasswordConfirm,
    setFullNameRu,
    setFullNameKk,
    setTenantSlug,
    setOrgNameRu,
    setOrgNameKk,
  } = useAuthForm(config.bootstrap_needed ? "signup" : "signin");

  useEffect(() => {
    if (config.bootstrap_needed) {
      setMode("signup");
    }
  }, [config.bootstrap_needed, setMode]);

  useEffect(() => {
    if (config.resolved_tenant?.slug) {
      setTenantSlug(config.resolved_tenant.slug);
    }
  }, [config.resolved_tenant?.slug, setTenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "signin") {
      const parsed = signInInputSchema.safeParse({
        email,
        password,
        tenantSlug: config.require_tenant_slug && !config.resolved_tenant ? tenantSlug : undefined,
      });
      if (!parsed.success) {
        toast.error(formatAuthValidationIssues(parsed.error.issues, t));
        return;
      }
      const slug =
        config.resolved_tenant?.slug ??
        (config.require_tenant_slug ? tenantSlug.trim() : undefined);
      await signIn(parsed.data.email, parsed.data.password, slug);
      return;
    }

    const parsedSignup = signUpInputSchema.safeParse({
      email,
      password,
      fullNameRu,
      fullNameKk,
      tenantSlug: config.bootstrap_needed ? tenantSlug : undefined,
      orgNameRu: config.bootstrap_needed ? orgNameRu : undefined,
      orgNameKk: config.bootstrap_needed ? orgNameKk : undefined,
    });
    if (!parsedSignup.success) {
      toast.error(formatAuthValidationIssues(parsedSignup.error.issues, t));
      return;
    }

    if (password !== passwordConfirm) {
      toast.error(t("auth.error.passwordMismatch"));
      return;
    }
    if (password.length < config.min_password_length) {
      toast.error(t("auth.passwordHint").replace("{n}", String(config.min_password_length)));
      return;
    }

    if (config.bootstrap_needed && !tenantSlug.trim()) {
      toast.error(t("auth.error.tenantSlugRequired"));
      return;
    }

    await signUp({
      email: parsedSignup.data.email,
      password: parsedSignup.data.password,
      fullNameRu: parsedSignup.data.fullNameRu,
      fullNameKk: parsedSignup.data.fullNameKk,
      locale,
      bootstrap: config.bootstrap_needed,
      tenantSlug: tenantSlug.trim() || undefined,
      orgNameRu: orgNameRu.trim() || undefined,
      orgNameKk: orgNameKk.trim() || undefined,
    });
  };

  const authTenantSlug =
    config.resolved_tenant?.slug ??
    (config.require_tenant_slug ? tenantSlug.trim() : undefined);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(380px,42%)_1fr]">
      <AuthLeftPanel />

      <div className="flex min-h-screen flex-col">
        <div className="flex justify-end p-4">
          <LanguageSwitcher />
        </div>

        <AuthRightPanel
          mode={mode}
          config={config}
          email={email}
          password={password}
          passwordConfirm={passwordConfirm}
          fullNameRu={fullNameRu}
          fullNameKk={fullNameKk}
          tenantSlug={tenantSlug}
          orgNameRu={orgNameRu}
          orgNameKk={orgNameKk}
          loading={loading || edsLoading || ldapLoading}
          onModeChange={setMode}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onPasswordConfirmChange={setPasswordConfirm}
          onFullNameRuChange={setFullNameRu}
          onFullNameKkChange={setFullNameKk}
          onTenantSlugChange={setTenantSlug}
          onOrgNameRuChange={setOrgNameRu}
          onOrgNameKkChange={setOrgNameKk}
          onSubmit={handleSubmit}
          onEdsAuth={() => {
            const { linkEmail, linkPassword } = resolveEdsLinkCredentials(email, password);
            return signInWithEds(
              mode,
              fullNameRu || undefined,
              fullNameKk || undefined,
              linkEmail,
              linkPassword,
              authTenantSlug,
            );
          }}
          edsLoading={edsLoading}
          ldapLoading={ldapLoading}
          onLdapAuth={(username, password) =>
            signInWithLdap(username, password, authTenantSlug)
          }
        />
      </div>
    </div>
  );
}
