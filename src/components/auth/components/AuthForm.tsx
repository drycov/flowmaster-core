import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import type { AuthMode } from "../types";

interface AuthFormProps {
  mode: AuthMode;
  email: string;
  password: string;
  passwordConfirm: string;
  fullNameRu: string;
  fullNameKk: string;
  tenantSlug: string;
  orgNameRu: string;
  orgNameKk: string;
  showTenantSlug?: boolean;
  showBootstrapOrg?: boolean;
  tenantSlugReadOnly?: boolean;
  tenantBaseDomain?: string | null;
  minPasswordLength: number;
  requireStrongPassword?: boolean;
  loading: boolean;
  showForgotPassword?: boolean;
  onForgotPassword?: () => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onFullNameRuChange: (value: string) => void;
  onFullNameKkChange: (value: string) => void;
  onTenantSlugChange: (value: string) => void;
  onOrgNameRuChange: (value: string) => void;
  onOrgNameKkChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function AuthForm({
  mode,
  email,
  password,
  passwordConfirm,
  fullNameRu,
  fullNameKk,
  tenantSlug,
  orgNameRu,
  orgNameKk,
  showTenantSlug = false,
  showBootstrapOrg = false,
  tenantSlugReadOnly = false,
  tenantBaseDomain,
  minPasswordLength,
  requireStrongPassword = false,
  loading,
  showForgotPassword,
  onForgotPassword,
  onEmailChange,
  onPasswordChange,
  onPasswordConfirmChange,
  onFullNameRuChange,
  onFullNameKkChange,
  onTenantSlugChange,
  onOrgNameRuChange,
  onOrgNameKkChange,
  onSubmit,
}: AuthFormProps) {
  const { t } = useI18n();

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {showBootstrapOrg && mode === "signup" && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("auth.tenant.bootstrapOrgTitle")}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("auth.tenant.orgNameRu")}</Label>
              <Input
                value={orgNameRu}
                onChange={(e) => onOrgNameRuChange(e.target.value)}
                disabled={loading}
                placeholder={t("auth.tenant.orgNamePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("auth.tenant.orgNameKk")}</Label>
              <Input
                value={orgNameKk}
                onChange={(e) => onOrgNameKkChange(e.target.value)}
                disabled={loading}
                placeholder={t("auth.tenant.orgNameKkPlaceholder")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("auth.tenant.slug")}</Label>
            <div className="flex items-center gap-2">
              <Input
                value={tenantSlug}
                onChange={(e) => onTenantSlugChange(e.target.value.toLowerCase())}
                disabled={loading || tenantSlugReadOnly}
                required
                placeholder="acme"
                className="font-mono"
              />
              {tenantBaseDomain && (
                <span className="shrink-0 text-xs text-muted-foreground">.{tenantBaseDomain}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("auth.tenant.slugHint")}</p>
          </div>
        </div>
      )}

      {showTenantSlug && !showBootstrapOrg && (
        <div className="space-y-1.5">
          <Label>{t("auth.tenant.slug")}</Label>
          <div className="flex items-center gap-2">
            <Input
              value={tenantSlug}
              onChange={(e) => onTenantSlugChange(e.target.value.toLowerCase())}
              disabled={loading || tenantSlugReadOnly}
              required={showTenantSlug}
              placeholder="acme"
              className="font-mono"
            />
            {tenantBaseDomain && (
              <span className="shrink-0 text-xs text-muted-foreground">.{tenantBaseDomain}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("auth.tenant.slugLoginHint")}</p>
        </div>
      )}

      {mode === "signup" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("auth.fullnameRu")}</Label>
            <Input
              value={fullNameRu}
              onChange={(e) => onFullNameRuChange(e.target.value)}
              required
              disabled={loading}
              placeholder={t("auth.placeholder.fullName")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("auth.fullnameKk")}</Label>
            <Input
              value={fullNameKk}
              onChange={(e) => onFullNameKkChange(e.target.value)}
              required
              disabled={loading}
              placeholder={t("auth.placeholder.fullNameKk")}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>{t("auth.email")}</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          disabled={loading}
          autoComplete="email"
          placeholder={t("auth.placeholder.email")}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("auth.password")}</Label>
          {mode === "signin" && showForgotPassword && onForgotPassword && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={onForgotPassword}
            >
              {t("auth.telegram.forgotPassword")}
            </button>
          )}
        </div>
        <Input
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          minLength={mode === "signup" ? minPasswordLength : 1}
          disabled={loading}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="••••••••"
        />
        {mode === "signup" && (
          <p className="text-xs text-muted-foreground">
            {requireStrongPassword
              ? `${t("auth.passwordHintStrong")}. ${t("auth.passwordHintMin").replace("{n}", String(minPasswordLength))}`
              : t("auth.passwordHint").replace("{n}", String(minPasswordLength))}
          </p>
        )}
      </div>

      {mode === "signup" && (
        <div className="space-y-1.5">
          <Label>{t("auth.passwordConfirm")}</Label>
          <Input
            type="password"
            value={passwordConfirm}
            onChange={(e) => onPasswordConfirmChange(e.target.value)}
            required
            minLength={minPasswordLength}
            disabled={loading}
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </div>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? t("common.loading") : mode === "signin" ? t("auth.signin") : t("auth.signup")}
      </Button>
    </form>
  );
}
