import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LdapLoginForm } from "@/components/auth/components/LdapLoginForm";
import { TelegramLoginPanel } from "@/components/auth/components/TelegramLoginPanel";
import { sap, sapButtonDefaultClass } from "@/components/auth/styles/sap-tokens";
import { useI18n } from "@/i18n";
import type { AuthMode } from "../types";

interface AuthAlternativeMethodsProps {
  mode: AuthMode;
  showEds: boolean;
  showTelegram: boolean;
  showLdap: boolean;
  loading: boolean;
  edsLoading: boolean;
  ldapLoading: boolean;
  tenantSlug: string;
  showTenantSlug: boolean;
  tenantSlugReadOnly: boolean;
  tenantBaseDomain: string | null;
  onEdsAuth: () => void;
  onLdapAuth?: (username: string, password: string) => Promise<void>;
  onTenantSlugChange: (value: string) => void;
}

export function AuthAlternativeMethods({
  mode,
  showEds,
  showTelegram,
  showLdap,
  loading,
  edsLoading,
  ldapLoading,
  tenantSlug,
  showTenantSlug,
  tenantSlugReadOnly,
  tenantBaseDomain,
  onEdsAuth,
  onLdapAuth,
  onTenantSlugChange,
}: AuthAlternativeMethodsProps) {
  const { t } = useI18n();

  if (!showEds && !showTelegram && !showLdap) {
    return null;
  }

  return (
    <div className="space-y-3 border-t pt-5" style={{ borderColor: sap.border }}>
      <div>
        <h2 className="text-sm font-semibold" style={{ color: sap.text }}>
          {t("auth.alternativeMethods.title")}
        </h2>
        <p className="mt-1 text-xs" style={{ color: sap.textSecondary }}>
          {t("auth.alternativeMethods.description")}
        </p>
      </div>

      <div className="space-y-2">
        {showTelegram && (
          <div
            className="rounded-sm border p-3"
            style={{ borderColor: sap.borderLight, backgroundColor: sap.pageBg }}
          >
            <TelegramLoginPanel tenantSlug={tenantSlug} />
            <p className="mt-2 text-center text-[11px]" style={{ color: sap.textMuted }}>
              {t("auth.telegram.loginHint")}
            </p>
          </div>
        )}

        {showEds && (
          <Button
            type="button"
            variant="outline"
            disabled={loading || edsLoading}
            onClick={onEdsAuth}
            className={sapButtonDefaultClass}
          >
            <LockKeyhole className="h-4 w-4" style={{ color: sap.brand }} />
            {mode === "signup" ? t("auth.edsSignUp") : t("auth.edsSignIn")}
          </Button>
        )}

        {showLdap && onLdapAuth && (
          <div
            className="rounded-sm border p-3"
            style={{ borderColor: sap.borderLight, backgroundColor: sap.pageBg }}
          >
            <LdapLoginForm
              loading={loading || ldapLoading}
              tenantSlug={tenantSlug}
              showTenantSlug={showTenantSlug}
              tenantSlugReadOnly={tenantSlugReadOnly}
              tenantBaseDomain={tenantBaseDomain}
              onTenantSlugChange={onTenantSlugChange}
              onSubmit={onLdapAuth}
            />
          </div>
        )}
      </div>
    </div>
  );
}
