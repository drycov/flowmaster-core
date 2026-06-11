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
  return (
    <section className="order-1 flex flex-col justify-center px-4 py-8 sm:px-8 lg:order-2 lg:px-10 lg:py-12 xl:px-14 2xl:px-16">
      <div className="mx-auto flex w-full justify-center">
        <AuthLoginCard {...props} />
      </div>
    </section>
  );
}
