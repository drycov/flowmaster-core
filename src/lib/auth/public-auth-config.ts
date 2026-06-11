import type { PublicAuthConfig } from "@/components/auth/types";

/** Placeholder while `/auth` loads public config (no optimistic bootstrap). */
export const DEFAULT_PUBLIC_AUTH_CONFIG: PublicAuthConfig = {
  bootstrap_needed: false,
  allow_public_signup: false,
  allow_eds_signup: false,
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

export type EffectiveAuthFlags = {
  effectiveSignup: boolean;
  effectiveEdsSignup: boolean;
  effectiveLdapLogin: boolean;
};

export function computeEffectiveAuthFlags(
  meta: { bootstrap_needed: boolean },
  auth: { allow_public_signup: boolean; allow_eds_signup: boolean },
  ldapEnabled: boolean,
): EffectiveAuthFlags {
  return {
    effectiveSignup: meta.bootstrap_needed || auth.allow_public_signup,
    effectiveEdsSignup: meta.bootstrap_needed || auth.allow_eds_signup,
    effectiveLdapLogin: !meta.bootstrap_needed && ldapEnabled,
  };
}

/** Auth slice returned by getPublicAuthConfig (before tenant context merge). */
export type PublicAuthPolicySlice = Pick<
  PublicAuthConfig,
  | "bootstrap_needed"
  | "allow_public_signup"
  | "allow_eds_signup"
  | "allow_ldap_login"
  | "telegram_bot_configured"
  | "telegram_notifications_enabled"
  | "allow_telegram_login"
  | "allow_telegram_password_reset"
  | "min_password_length"
  | "require_strong_password"
>;
