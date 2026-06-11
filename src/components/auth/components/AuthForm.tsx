import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/components/PasswordInput";
import {
  btnPrimaryPillClass,
  fieldClass,
  fieldLgClass,
  labelClass,
  linkClass,
} from "@/lib/design-tokens";
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

export function AuthForm(props: AuthFormProps) {
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
  } = props;

  const { t } = useI18n();
  const isMinimalSignIn = mode === "signin";
  const inputClass = isMinimalSignIn ? fieldLgClass : fieldClass;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {showBootstrapOrg && mode === "signup" && (
        <div className="space-y-3 rounded-lg bg-muted/60 p-4">
          <p className={labelClass}>{t("auth.tenant.bootstrapOrgTitle")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className={labelClass}>{t("auth.tenant.orgNameRu")}</Label>
              <Input
                value={orgNameRu}
                onChange={(e) => onOrgNameRuChange(e.target.value)}
                disabled={loading}
                placeholder={t("auth.tenant.orgNamePlaceholder")}
                className={fieldClass}
              />
            </div>
            <div className="space-y-1">
              <Label className={labelClass}>{t("auth.tenant.orgNameKk")}</Label>
              <Input
                value={orgNameKk}
                onChange={(e) => onOrgNameKkChange(e.target.value)}
                disabled={loading}
                placeholder={t("auth.tenant.orgNameKkPlaceholder")}
                className={fieldClass}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className={labelClass}>{t("auth.tenant.slug")}</Label>
            <Input
              value={tenantSlug}
              onChange={(e) => onTenantSlugChange(e.target.value.toLowerCase())}
              disabled={loading || tenantSlugReadOnly}
              required
              placeholder="acme"
              className={`${fieldClass} font-mono`}
            />
          </div>
        </div>
      )}

      {showTenantSlug && !showBootstrapOrg && (
        <div className="space-y-1">
          <Label className={labelClass}>{t("auth.tenant.slug")}</Label>
          <Input
            value={tenantSlug}
            onChange={(e) => onTenantSlugChange(e.target.value.toLowerCase())}
            disabled={loading || tenantSlugReadOnly}
            required={showTenantSlug}
            placeholder="acme"
            className={`${fieldClass} font-mono`}
          />
        </div>
      )}

      {mode === "signup" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className={labelClass}>{t("auth.fullnameRu")}</Label>
            <Input
              value={fullNameRu}
              onChange={(e) => onFullNameRuChange(e.target.value)}
              required
              disabled={loading}
              className={fieldClass}
            />
          </div>
          <div className="space-y-1">
            <Label className={labelClass}>{t("auth.fullnameKk")}</Label>
            <Input
              value={fullNameKk}
              onChange={(e) => onFullNameKkChange(e.target.value)}
              required
              disabled={loading}
              className={fieldClass}
            />
          </div>
        </div>
      )}

      <div className={isMinimalSignIn ? undefined : "space-y-1"}>
        {!isMinimalSignIn && (
          <Label className={labelClass} htmlFor="auth-email">
            {t("auth.email")}
          </Label>
        )}
        <Input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          disabled={loading}
          autoComplete="email"
          placeholder={isMinimalSignIn ? t("auth.placeholder.emailField") : t("auth.placeholder.email")}
          className={inputClass}
        />
      </div>

      <div className={isMinimalSignIn ? "space-y-2" : "space-y-1"}>
        {!isMinimalSignIn && (
          <Label className={labelClass} htmlFor="auth-password">
            {t("auth.password")}
          </Label>
        )}
        {isMinimalSignIn ? (
          <PasswordInput
            id="auth-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            required
            disabled={loading}
            autoComplete="current-password"
            placeholder={t("auth.placeholder.passwordField")}
          />
        ) : (
          <PasswordInput
            id="auth-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            required
            minLength={minPasswordLength}
            disabled={loading}
            autoComplete="new-password"
            placeholder="••••••••"
            className={fieldClass}
          />
        )}
        {mode === "signin" && showForgotPassword && onForgotPassword && (
          <div className="flex justify-end">
            <button type="button" className={linkClass} onClick={onForgotPassword}>
              {t("auth.telegram.forgotPassword")}
            </button>
          </div>
        )}
      </div>

      {mode === "signup" && (
        <div className="space-y-1">
          <Label className={labelClass}>{t("auth.passwordConfirm")}</Label>
          <PasswordInput
            value={passwordConfirm}
            onChange={(e) => onPasswordConfirmChange(e.target.value)}
            required
            minLength={minPasswordLength}
            disabled={loading}
            autoComplete="new-password"
            placeholder="••••••••"
            className={fieldClass}
          />
        </div>
      )}

      <div className="pt-2">
        <Button type="submit" className={btnPrimaryPillClass} disabled={loading}>
          {loading ? t("common.loading") : mode === "signin" ? t("auth.signin") : t("auth.signup")}
        </Button>
      </div>
    </form>
  );
}
