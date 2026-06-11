import { AuthLoginCard } from "./AuthLoginCard";
import type { AuthMode, PublicAuthConfig } from "../types";

interface AuthLoginPanelProps {
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

export function AuthLoginPanel(props: AuthLoginPanelProps) {
  const wide = props.config.bootstrap_needed;
  return (
    <div className={`w-full ${wide ? "max-w-md" : "max-w-[400px]"}`}>
      <AuthLoginCard {...props} />
    </div>
  );
}
