import { Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LdapLoginFormProps {
  loading: boolean;
  tenantSlug?: string;
  showTenantSlug?: boolean;
  tenantSlugReadOnly?: boolean;
  tenantBaseDomain?: string | null;
  onTenantSlugChange?: (value: string) => void;
  onSubmit: (username: string, password: string) => Promise<void>;
}

export function LdapLoginForm({
  loading,
  tenantSlug = "",
  showTenantSlug = false,
  tenantSlugReadOnly = false,
  tenantBaseDomain,
  onTenantSlugChange,
  onSubmit,
}: LdapLoginFormProps) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(username, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showTenantSlug && (
        <div className="space-y-1.5">
          <Label htmlFor="ldap-tenant-slug">{t("auth.tenant.slug")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="ldap-tenant-slug"
              value={tenantSlug}
              onChange={(e) => onTenantSlugChange?.(e.target.value.toLowerCase())}
              disabled={loading || tenantSlugReadOnly}
              required
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

      <div className="space-y-1.5">
        <Label htmlFor="ldap-username">{t("auth.ldapUsername")}</Label>
        <Input
          id="ldap-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("auth.ldapUsernamePlaceholder")}
          autoComplete="username"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ldap-password">{t("auth.ldapPassword")}</Label>
        <Input
          id="ldap-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" variant="outline" className="w-full" disabled={loading}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Building2 className="mr-2 h-4 w-4" />
        )}
        {t("auth.ldapSignIn")}
      </Button>
    </form>
  );
}
