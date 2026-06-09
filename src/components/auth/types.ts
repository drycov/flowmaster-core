export type AuthMode = "signin" | "signup";

export interface AuthFormData {
  email: string;
  password: string;
  passwordConfirm?: string;
  fullNameRu?: string;
  fullNameKk?: string;
}

export type PublicTenantInfo = {
  slug: string;
  name_ru: string;
  name_kk: string;
} | null;

export type PublicAuthConfig = {
  bootstrap_needed: boolean;
  allow_public_signup: boolean;
  allow_eds_signup: boolean;
  allow_ldap_login: boolean;
  telegram_bot_configured: boolean;
  telegram_notifications_enabled: boolean;
  allow_telegram_login: boolean;
  allow_telegram_password_reset: boolean;
  min_password_length: number;
  require_strong_password: boolean;
  multi_tenant: boolean;
  organization_count: number;
  resolved_tenant: PublicTenantInfo;
  require_tenant_slug: boolean;
  tenant_base_domain: string | null;
};
