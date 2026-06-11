import { LockKeyhole, Loader2 } from "lucide-react";

import { AuthOrDivider } from "@/components/auth/components/AuthOrDivider";
import { LdapLoginForm } from "@/components/auth/components/LdapLoginForm";
import { TelegramLoginPanel } from "@/components/auth/components/TelegramLoginPanel";
import { linkClass } from "@/lib/design-tokens";
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

  const edsLabel = mode === "signup" ? t("auth.edsSignUp") : t("auth.edsSignIn");

  return (
    <div className="space-y-4 pt-1">
      {(showEds || showTelegram) && (
        <>
          <AuthOrDivider />
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {showEds && (
              <button
                type="button"
                disabled={loading || edsLoading}
                onClick={onEdsAuth}
                className={`inline-flex items-center gap-1.5 disabled:opacity-50 ${linkClass}`}
              >
                {edsLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LockKeyhole className="h-3.5 w-3.5" />
                )}
                {edsLabel}
              </button>
            )}
            {showTelegram && <TelegramLoginPanel tenantSlug={tenantSlug} variant="link" />}
          </div>
        </>
      )}

      {showLdap && onLdapAuth && (
        <div className="border-t border-border pt-4">
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
  );
}
