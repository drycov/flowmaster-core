import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AppRole } from "@/lib/auth/roles";
import { isBootstrapNeeded, loadSystemInitStatus } from "@/lib/system/init-status.server";

export type AuthPolicySettings = {
  allow_public_signup: boolean;
  allow_eds_signup: boolean;
  min_password_length: number;
  require_strong_password: boolean;
  session_ttl_hours: number;
  allowed_email_domains: string[];
};

export type EdsPolicySettings = {
  require_iin_match: boolean;
  require_cert_valid: boolean;
  allow_org_certificate: boolean;
};

export type GeneralPolicySettings = {
  default_locale: "ru" | "kk";
  app_url: string;
};

export type IntegrationsPolicySettings = {
  office_enabled: boolean;
  office_url: string;
  s3_endpoint: string;
  s3_region: string;
  s3_access_key_id: string;
  s3_secret_access_key: string;
};

export type MailPolicySettings = {
  enabled: boolean;
  provider: "resend" | "smtp";
  from_address: string;
  from_name: string;
  resend_api_key: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_secure: boolean;
};

export type TelegramPolicySettings = {
  enabled: boolean;
  bot_token: string;
  default_chat_id: string;
  webhook_secret: string;
  allow_telegram_login: boolean;
  allow_telegram_password_reset: boolean;
  notify_on_tasks: boolean;
  notify_on_approvals: boolean;
};

export type LdapPolicySettings = {
  enabled: boolean;
  url: string;
  base_dn: string;
  bind_dn: string;
  bind_password: string;
  user_filter: string;
  email_attr: string;
  display_name_attr: string;
  auto_provision: boolean;
  default_role: AppRole;
  reject_unauthorized: boolean;
};

export type SystemSettings = {
  auth: AuthPolicySettings;
  eds: EdsPolicySettings;
  general: GeneralPolicySettings;
  integrations: IntegrationsPolicySettings;
  ldap: LdapPolicySettings;
  mail: MailPolicySettings;
  telegram: TelegramPolicySettings;
};

export type SystemSettingsMeta = {
  bootstrap_needed: boolean;
  has_admin: boolean;
  admin_count: number;
  has_resend_api_key: boolean;
  has_smtp_password: boolean;
  has_telegram_bot_token: boolean;
  has_telegram_webhook: boolean;
  has_ldap_bind_password: boolean;
  has_s3_secret: boolean;
  has_app_url: boolean;
  has_office_url: boolean;
};

export type SystemSettingsResponse = {
  settings: SystemSettings;
  meta: SystemSettingsMeta;
};

export type PublicAuthConfig = {
  bootstrap_needed: boolean;
  allow_public_signup: boolean;
  allow_eds_signup: boolean;
  allow_ldap_login: boolean;
  /** Bot token configured and org past bootstrap */
  telegram_bot_configured: boolean;
  /** Org-level Telegram notifications toggle */
  telegram_notifications_enabled: boolean;
  allow_telegram_login: boolean;
  allow_telegram_password_reset: boolean;
  min_password_length: number;
  require_strong_password: boolean;
};

const DEFAULT_AUTH: AuthPolicySettings = {
  allow_public_signup: false,
  allow_eds_signup: true,
  min_password_length: 8,
  require_strong_password: false,
  session_ttl_hours: 168,
  allowed_email_domains: [],
};

const DEFAULT_EDS: EdsPolicySettings = {
  require_iin_match: true,
  require_cert_valid: true,
  allow_org_certificate: true,
};

const DEFAULT_LDAP: LdapPolicySettings = {
  enabled: false,
  url: "",
  base_dn: "",
  bind_dn: "",
  bind_password: "",
  user_filter: "(&(objectClass=user)(sAMAccountName={{username}}))",
  email_attr: "mail",
  display_name_attr: "displayName",
  auto_provision: true,
  default_role: "viewer",
  reject_unauthorized: true,
};

const DEFAULT_GENERAL: GeneralPolicySettings = {
  default_locale: "ru",
  app_url: "",
};

const DEFAULT_INTEGRATIONS: IntegrationsPolicySettings = {
  office_enabled: false,
  office_url: "",
  s3_endpoint: "",
  s3_region: "auto",
  s3_access_key_id: "",
  s3_secret_access_key: "",
};

const DEFAULT_MAIL: MailPolicySettings = {
  enabled: false,
  provider: "resend",
  from_address: "",
  from_name: "ЕСЭДО",
  resend_api_key: "",
  smtp_host: "",
  smtp_port: 587,
  smtp_user: "",
  smtp_password: "",
  smtp_secure: false,
};

const DEFAULT_TELEGRAM: TelegramPolicySettings = {
  enabled: false,
  bot_token: "",
  default_chat_id: "",
  webhook_secret: "",
  allow_telegram_login: true,
  allow_telegram_password_reset: true,
  notify_on_tasks: true,
  notify_on_approvals: true,
};

export function parseSystemSettings(raw: unknown): SystemSettings {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const authRaw =
    root.auth && typeof root.auth === "object" ? (root.auth as Record<string, unknown>) : {};
  const edsRaw =
    root.eds && typeof root.eds === "object" ? (root.eds as Record<string, unknown>) : {};
  const ldapRaw =
    root.ldap && typeof root.ldap === "object" ? (root.ldap as Record<string, unknown>) : {};
  const generalRaw =
    root.general && typeof root.general === "object"
      ? (root.general as Record<string, unknown>)
      : {};
  const integrationsRaw =
    root.integrations && typeof root.integrations === "object"
      ? (root.integrations as Record<string, unknown>)
      : {};
  const mailRaw =
    root.mail && typeof root.mail === "object" ? (root.mail as Record<string, unknown>) : {};
  const telegramRaw =
    root.telegram && typeof root.telegram === "object"
      ? (root.telegram as Record<string, unknown>)
      : {};

  const domains = Array.isArray(authRaw.allowed_email_domains)
    ? authRaw.allowed_email_domains.filter(
        (d): d is string => typeof d === "string" && d.length > 0,
      )
    : DEFAULT_AUTH.allowed_email_domains;

  const sessionTtl =
    typeof authRaw.session_ttl_hours === "number" && authRaw.session_ttl_hours >= 1
      ? Math.min(Math.round(authRaw.session_ttl_hours), 720)
      : DEFAULT_AUTH.session_ttl_hours;

  const defaultLocale = generalRaw.default_locale === "kk" ? "kk" : "ru";

  return {
    auth: {
      allow_public_signup:
        typeof authRaw.allow_public_signup === "boolean"
          ? authRaw.allow_public_signup
          : DEFAULT_AUTH.allow_public_signup,
      allow_eds_signup:
        typeof authRaw.allow_eds_signup === "boolean"
          ? authRaw.allow_eds_signup
          : DEFAULT_AUTH.allow_eds_signup,
      min_password_length:
        typeof authRaw.min_password_length === "number" && authRaw.min_password_length >= 8
          ? Math.min(authRaw.min_password_length, 128)
          : DEFAULT_AUTH.min_password_length,
      require_strong_password:
        typeof authRaw.require_strong_password === "boolean"
          ? authRaw.require_strong_password
          : DEFAULT_AUTH.require_strong_password,
      session_ttl_hours: sessionTtl,
      allowed_email_domains: domains.map((d) => d.toLowerCase().trim()),
    },
    eds: {
      require_iin_match:
        typeof edsRaw.require_iin_match === "boolean"
          ? edsRaw.require_iin_match
          : DEFAULT_EDS.require_iin_match,
      require_cert_valid:
        typeof edsRaw.require_cert_valid === "boolean"
          ? edsRaw.require_cert_valid
          : DEFAULT_EDS.require_cert_valid,
      allow_org_certificate:
        typeof edsRaw.allow_org_certificate === "boolean"
          ? edsRaw.allow_org_certificate
          : DEFAULT_EDS.allow_org_certificate,
    },
    general: {
      default_locale: defaultLocale,
      app_url:
        typeof generalRaw.app_url === "string"
          ? generalRaw.app_url.trim()
          : DEFAULT_GENERAL.app_url,
    },
    integrations: {
      office_enabled:
        typeof integrationsRaw.office_enabled === "boolean"
          ? integrationsRaw.office_enabled
          : DEFAULT_INTEGRATIONS.office_enabled,
      office_url:
        typeof integrationsRaw.office_url === "string"
          ? integrationsRaw.office_url.trim()
          : DEFAULT_INTEGRATIONS.office_url,
      s3_endpoint:
        typeof integrationsRaw.s3_endpoint === "string"
          ? integrationsRaw.s3_endpoint.trim()
          : DEFAULT_INTEGRATIONS.s3_endpoint,
      s3_region:
        typeof integrationsRaw.s3_region === "string" && integrationsRaw.s3_region.trim()
          ? integrationsRaw.s3_region.trim()
          : DEFAULT_INTEGRATIONS.s3_region,
      s3_access_key_id:
        typeof integrationsRaw.s3_access_key_id === "string"
          ? integrationsRaw.s3_access_key_id.trim()
          : DEFAULT_INTEGRATIONS.s3_access_key_id,
      s3_secret_access_key:
        typeof integrationsRaw.s3_secret_access_key === "string"
          ? integrationsRaw.s3_secret_access_key
          : DEFAULT_INTEGRATIONS.s3_secret_access_key,
    },
    ldap: {
      enabled: typeof ldapRaw.enabled === "boolean" ? ldapRaw.enabled : DEFAULT_LDAP.enabled,
      url: typeof ldapRaw.url === "string" ? ldapRaw.url.trim() : DEFAULT_LDAP.url,
      base_dn: typeof ldapRaw.base_dn === "string" ? ldapRaw.base_dn.trim() : DEFAULT_LDAP.base_dn,
      bind_dn: typeof ldapRaw.bind_dn === "string" ? ldapRaw.bind_dn.trim() : DEFAULT_LDAP.bind_dn,
      bind_password:
        typeof ldapRaw.bind_password === "string"
          ? ldapRaw.bind_password
          : DEFAULT_LDAP.bind_password,
      user_filter:
        typeof ldapRaw.user_filter === "string" && ldapRaw.user_filter.trim()
          ? ldapRaw.user_filter.trim()
          : DEFAULT_LDAP.user_filter,
      email_attr:
        typeof ldapRaw.email_attr === "string" && ldapRaw.email_attr.trim()
          ? ldapRaw.email_attr.trim()
          : DEFAULT_LDAP.email_attr,
      display_name_attr:
        typeof ldapRaw.display_name_attr === "string" && ldapRaw.display_name_attr.trim()
          ? ldapRaw.display_name_attr.trim()
          : DEFAULT_LDAP.display_name_attr,
      auto_provision:
        typeof ldapRaw.auto_provision === "boolean"
          ? ldapRaw.auto_provision
          : DEFAULT_LDAP.auto_provision,
      default_role:
        typeof ldapRaw.default_role === "string" &&
        ["admin", "registrar", "approver", "signer", "archivist", "viewer"].includes(
          ldapRaw.default_role,
        )
          ? (ldapRaw.default_role as AppRole)
          : DEFAULT_LDAP.default_role,
      reject_unauthorized:
        typeof ldapRaw.reject_unauthorized === "boolean"
          ? ldapRaw.reject_unauthorized
          : DEFAULT_LDAP.reject_unauthorized,
    },
    mail: {
      enabled: typeof mailRaw.enabled === "boolean" ? mailRaw.enabled : DEFAULT_MAIL.enabled,
      provider: mailRaw.provider === "smtp" ? "smtp" : "resend",
      from_address:
        typeof mailRaw.from_address === "string"
          ? mailRaw.from_address.trim()
          : DEFAULT_MAIL.from_address,
      from_name:
        typeof mailRaw.from_name === "string" && mailRaw.from_name.trim()
          ? mailRaw.from_name.trim()
          : DEFAULT_MAIL.from_name,
      resend_api_key:
        typeof mailRaw.resend_api_key === "string"
          ? mailRaw.resend_api_key.trim()
          : DEFAULT_MAIL.resend_api_key,
      smtp_host:
        typeof mailRaw.smtp_host === "string" ? mailRaw.smtp_host.trim() : DEFAULT_MAIL.smtp_host,
      smtp_port:
        typeof mailRaw.smtp_port === "number" && mailRaw.smtp_port > 0
          ? Math.round(mailRaw.smtp_port)
          : DEFAULT_MAIL.smtp_port,
      smtp_user:
        typeof mailRaw.smtp_user === "string" ? mailRaw.smtp_user.trim() : DEFAULT_MAIL.smtp_user,
      smtp_password:
        typeof mailRaw.smtp_password === "string"
          ? mailRaw.smtp_password
          : DEFAULT_MAIL.smtp_password,
      smtp_secure:
        typeof mailRaw.smtp_secure === "boolean" ? mailRaw.smtp_secure : DEFAULT_MAIL.smtp_secure,
    },
    telegram: {
      enabled:
        typeof telegramRaw.enabled === "boolean" ? telegramRaw.enabled : DEFAULT_TELEGRAM.enabled,
      bot_token:
        typeof telegramRaw.bot_token === "string"
          ? telegramRaw.bot_token.trim()
          : DEFAULT_TELEGRAM.bot_token,
      default_chat_id:
        typeof telegramRaw.default_chat_id === "string"
          ? telegramRaw.default_chat_id.trim()
          : DEFAULT_TELEGRAM.default_chat_id,
      webhook_secret:
        typeof telegramRaw.webhook_secret === "string"
          ? telegramRaw.webhook_secret.trim()
          : DEFAULT_TELEGRAM.webhook_secret,
      allow_telegram_login:
        typeof telegramRaw.allow_telegram_login === "boolean"
          ? telegramRaw.allow_telegram_login
          : DEFAULT_TELEGRAM.allow_telegram_login,
      allow_telegram_password_reset:
        typeof telegramRaw.allow_telegram_password_reset === "boolean"
          ? telegramRaw.allow_telegram_password_reset
          : DEFAULT_TELEGRAM.allow_telegram_password_reset,
      notify_on_tasks:
        typeof telegramRaw.notify_on_tasks === "boolean"
          ? telegramRaw.notify_on_tasks
          : DEFAULT_TELEGRAM.notify_on_tasks,
      notify_on_approvals:
        typeof telegramRaw.notify_on_approvals === "boolean"
          ? telegramRaw.notify_on_approvals
          : DEFAULT_TELEGRAM.notify_on_approvals,
    },
  };
}

export function maskSystemSettingsForClient(settings: SystemSettings): SystemSettings {
  return {
    ...settings,
    ldap: { ...settings.ldap, bind_password: "" },
    integrations: { ...settings.integrations, s3_secret_access_key: "" },
    mail: { ...settings.mail, resend_api_key: "", smtp_password: "" },
    telegram: { ...settings.telegram, bot_token: "", webhook_secret: "" },
  };
}

export function mergeSecretField(incoming: string, current: string): string {
  return incoming.trim() ? incoming.trim() : current;
}

export function validatePassword(password: string, auth: AuthPolicySettings): string | null {
  if (password.length < auth.min_password_length) {
    return `Пароль должен быть не короче ${auth.min_password_length} символов`;
  }
  if (auth.require_strong_password) {
    if (!/[a-zа-яё]/.test(password)) {
      return "Пароль должен содержать строчную букву";
    }
    if (!/[A-ZА-ЯЁ]/.test(password)) {
      return "Пароль должен содержать заглавную букву";
    }
    if (!/[0-9]/.test(password)) {
      return "Пароль должен содержать цифру";
    }
  }
  return null;
}

export function normalizeEmailDomains(input: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of input) {
    const domain = raw.trim().toLowerCase().replace(/^@+/, "");
    if (!domain || seen.has(domain)) continue;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
      continue;
    }
    seen.add(domain);
    result.push(domain);
  }
  return result;
}

export async function loadSystemSettings(): Promise<SystemSettings> {
  const { data } = await supabaseAdmin
    .from("organization")
    .select("settings")
    .limit(1)
    .maybeSingle();
  return parseSystemSettings(data?.settings);
}

export async function getAdminCount(): Promise<number> {
  return (await loadSystemInitStatus()).admin_count;
}

export async function hasAdminUser(): Promise<boolean> {
  return !(await isBootstrapNeeded());
}

export async function loadSystemSettingsResponse(): Promise<SystemSettingsResponse> {
  const [settings, init] = await Promise.all([loadSystemSettings(), loadSystemInitStatus()]);
  const bootstrapNeeded = init.needs_bootstrap;
  return {
    settings: maskSystemSettingsForClient(settings),
    meta: {
      bootstrap_needed: bootstrapNeeded,
      has_admin: init.has_admin,
      admin_count: init.admin_count,
      has_resend_api_key: !!settings.mail.resend_api_key,
      has_smtp_password: !!settings.mail.smtp_password,
      has_telegram_bot_token: !!settings.telegram.bot_token,
      has_telegram_webhook: !!settings.telegram.webhook_secret,
      has_ldap_bind_password: !!settings.ldap.bind_password,
      has_s3_secret: !!settings.integrations.s3_secret_access_key,
      has_app_url: !!settings.general.app_url,
      has_office_url: !!settings.integrations.office_url,
    },
  };
}

export async function saveTelegramWebhookSecret(secret: string): Promise<void> {
  const { data: org, error: loadErr } = await supabaseAdmin
    .from("organization")
    .select("id, settings")
    .limit(1)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!org?.id) throw new Error("Организация не найдена");

  const current = parseSystemSettings(org.settings);
  const { error } = await supabaseAdmin
    .from("organization")
    .update({
      settings: {
        ...((org.settings as Record<string, unknown>) ?? {}),
        telegram: { ...current.telegram, webhook_secret: secret.trim() },
      },
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", org.id);
  if (error) throw new Error(error.message);
}

export async function getPublicAuthConfig(): Promise<PublicAuthConfig> {
  const { settings, meta } = await loadSystemSettingsResponse();

  const telegramBotConfigured = !meta.bootstrap_needed && meta.has_telegram_bot_token;

  return {
    bootstrap_needed: meta.bootstrap_needed,
    allow_public_signup: meta.bootstrap_needed || settings.auth.allow_public_signup,
    allow_eds_signup: meta.bootstrap_needed || settings.auth.allow_eds_signup,
    allow_ldap_login: !meta.bootstrap_needed && settings.ldap.enabled,
    telegram_bot_configured: telegramBotConfigured,
    telegram_notifications_enabled: telegramBotConfigured && settings.telegram.enabled,
    allow_telegram_login: telegramBotConfigured && settings.telegram.allow_telegram_login,
    allow_telegram_password_reset:
      telegramBotConfigured && settings.telegram.allow_telegram_password_reset,
    min_password_length: settings.auth.min_password_length,
    require_strong_password: settings.auth.require_strong_password,
  };
}

export function emailMatchesDomainPolicy(email: string, domains: string[]): boolean {
  if (!domains.length) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return domains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

export async function assertEmailRegistrationAllowed(email: string): Promise<{
  bootstrap: boolean;
  settings: AuthPolicySettings;
}> {
  const [init, settings] = await Promise.all([loadSystemInitStatus(), loadSystemSettings()]);
  const bootstrapNeeded = init.needs_bootstrap;

  if (!bootstrapNeeded && !settings.auth.allow_public_signup) {
    throw new Error(
      "Самостоятельная регистрация отключена. Обратитесь к администратору для получения учётной записи.",
    );
  }

  if (!emailMatchesDomainPolicy(email, settings.auth.allowed_email_domains)) {
    throw new Error("Регистрация разрешена только для корпоративных адресов электронной почты.");
  }

  return { bootstrap: bootstrapNeeded, settings: settings.auth };
}

export async function assertEdsRegistrationAllowed(): Promise<{ bootstrap: boolean }> {
  const [settings, init] = await Promise.all([loadSystemSettings(), loadSystemInitStatus()]);
  const bootstrapNeeded = init.needs_bootstrap;

  if (!bootstrapNeeded && !settings.auth.allow_eds_signup) {
    throw new Error(
      "Регистрация по ЭЦП отключена. Войдите в существующий аккаунт или обратитесь к администратору.",
    );
  }

  return { bootstrap: bootstrapNeeded };
}
