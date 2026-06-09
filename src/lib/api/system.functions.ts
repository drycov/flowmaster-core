import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getPublicAuthConfig,
  loadSystemSettings,
  loadSystemSettingsResponse,
  mergeSecretField,
  normalizeEmailDomains,
  parseSystemSettings,
  type SystemSettings,
  type SystemSettingsResponse,
} from "@/lib/auth/policy";
import { buildPublicTenantAuthContext } from "@/lib/access/tenant-public.server";
import type { PublicAuthConfig } from "@/components/auth/types";
import { requireSystemSettingsAccess } from "./_helpers";

export type SystemInitStatus = {
  has_organization: boolean;
  organization_configured: boolean;
  has_admin: boolean;
  admin_count: number;
  departments_count: number;
  permissions_count: number;
  roles_count: number;
  published_workflows: number;
  published_templates: number;
  needs_setup: boolean;
};

export const getSystemInitStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc(
      "get_system_init_status" as never,
    );
    if (error) {
      const [{ count: adminCount }, { count: deptCount }] = await Promise.all([
        context.supabase
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin" as never),
        context.supabase
          .from("departments")
          .select("id", { count: "exact", head: true }),
      ]);
      return {
        has_organization: true,
        organization_configured: false,
        has_admin: (adminCount ?? 0) > 0,
        admin_count: adminCount ?? 0,
        departments_count: deptCount ?? 0,
        permissions_count: 0,
        roles_count: 0,
        published_workflows: 0,
        published_templates: 0,
        needs_setup: (adminCount ?? 0) === 0 || (deptCount ?? 0) === 0,
      } satisfies SystemInitStatus;
    }
    return data as SystemInitStatus;
  });

export const getPublicAuthConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const host = request?.headers?.get("host") ?? null;
  const [auth, tenant] = await Promise.all([
    getPublicAuthConfig(),
    buildPublicTenantAuthContext(host),
  ]);
  return { ...auth, ...tenant } satisfies PublicAuthConfig;
});

export const getSystemSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSystemSettingsAccess(context.supabase, context.userId);
    return loadSystemSettingsResponse();
  });

const systemSettingsSchema = z.object({
  auth: z.object({
    allow_public_signup: z.boolean(),
    allow_eds_signup: z.boolean(),
    min_password_length: z.number().int().min(8).max(128),
    require_strong_password: z.boolean(),
    session_ttl_hours: z.number().int().min(1).max(720),
    allowed_email_domains: z.array(z.string().min(1).max(255)),
  }),
  eds: z.object({
    require_iin_match: z.boolean(),
    require_cert_valid: z.boolean(),
    allow_org_certificate: z.boolean(),
  }),
  general: z.object({
    default_locale: z.enum(["ru", "kk"]),
    app_url: z.string().max(500),
  }),
  integrations: z.object({
    office_enabled: z.boolean(),
    office_url: z.string().max(500),
    s3_endpoint: z.string().max(500),
    s3_region: z.string().max(64),
    s3_access_key_id: z.string().max(200),
    s3_secret_access_key: z.string().max(500),
  }),
  ldap: z.object({
    enabled: z.boolean(),
    url: z.string().max(500),
    base_dn: z.string().max(500),
    bind_dn: z.string().max(500),
    bind_password: z.string().max(500),
    user_filter: z.string().max(500),
    email_attr: z.string().max(120),
    display_name_attr: z.string().max(120),
    auto_provision: z.boolean(),
    default_role: z.enum(["admin", "registrar", "approver", "signer", "archivist", "viewer"]),
    reject_unauthorized: z.boolean(),
  }),
  mail: z.object({
    enabled: z.boolean(),
    provider: z.enum(["resend", "smtp"]),
    from_address: z.string().max(255),
    from_name: z.string().max(120),
    resend_api_key: z.string().max(500),
    smtp_host: z.string().max(255),
    smtp_port: z.number().int().min(1).max(65535),
    smtp_user: z.string().max(255),
    smtp_password: z.string().max(500),
    smtp_secure: z.boolean(),
  }),
  telegram: z.object({
    enabled: z.boolean(),
    bot_token: z.string().max(500),
    default_chat_id: z.string().max(64),
    allow_telegram_login: z.boolean(),
    allow_telegram_password_reset: z.boolean(),
    notify_on_tasks: z.boolean(),
    notify_on_approvals: z.boolean(),
  }),
});

export const updateSystemSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(systemSettingsSchema)
  .handler(async ({ data, context }) => {
    await requireSystemSettingsAccess(context.supabase, context.userId);

    const { data: org, error: loadErr } = await context.supabase
      .from("organization")
      .select("id, settings")
      .limit(1)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!org?.id) throw new Error("Организация не найдена");

    const current = parseSystemSettings(org.settings);
    const domains = normalizeEmailDomains(data.auth.allowed_email_domains);
    if (data.auth.allowed_email_domains.length > 0 && domains.length === 0) {
      throw new Error("Укажите корректные домены email (например, company.kz)");
    }

    const next: SystemSettings = {
      auth: {
        ...current.auth,
        ...data.auth,
        allowed_email_domains: domains,
      },
      eds: { ...current.eds, ...data.eds },
      general: { ...current.general, ...data.general },
      integrations: {
        ...current.integrations,
        ...data.integrations,
        s3_secret_access_key: mergeSecretField(
          data.integrations.s3_secret_access_key,
          current.integrations.s3_secret_access_key,
        ),
      },
      ldap: {
        ...current.ldap,
        ...data.ldap,
        bind_password: mergeSecretField(data.ldap.bind_password, current.ldap.bind_password),
      },
      mail: {
        ...current.mail,
        ...data.mail,
        resend_api_key: mergeSecretField(data.mail.resend_api_key, current.mail.resend_api_key),
        smtp_password: mergeSecretField(data.mail.smtp_password, current.mail.smtp_password),
      },
      telegram: {
        ...current.telegram,
        ...data.telegram,
        bot_token: mergeSecretField(data.telegram.bot_token, current.telegram.bot_token),
      },
    };

    const { error } = await supabaseAdmin
      .from("organization")
      .update({
        settings: {
          ...((org.settings as Record<string, unknown>) ?? {}),
          auth: next.auth,
          eds: next.eds,
          general: next.general,
          integrations: next.integrations,
          ldap: next.ldap,
          mail: next.mail,
          telegram: next.telegram,
        },
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", org.id);

    if (error) throw new Error(error.message);
    const { invalidateRuntimeSettingsCache } = await import("@/lib/app-origin.server");
    invalidateRuntimeSettingsCache();
    if (next.telegram.bot_token) {
      const { ensureTelegramPolling, getTelegramDeliveryMode } = await import(
        "@/lib/telegram/polling.server"
      );
      if ((await getTelegramDeliveryMode()) === "polling") {
        void ensureTelegramPolling();
      }
    }
    return { ok: true };
  });

const ldapSettingsSchema = systemSettingsSchema.shape.ldap;

export const testLdapConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ldap: ldapSettingsSchema.optional() }).optional())
  .handler(async ({ data, context }) => {
    await requireSystemSettingsAccess(context.supabase, context.userId);
    const full = await loadSystemSettings();
    const ldap = data?.ldap
      ? {
          ...full.ldap,
          ...data.ldap,
          bind_password: mergeSecretField(data.ldap.bind_password, full.ldap.bind_password),
          enabled: true,
        }
      : full.ldap;
    const { buildLdapRuntimeConfig, testLdapConnection: testConn } = await import(
      "@/lib/auth/ldap.server"
    );
    const config = buildLdapRuntimeConfig(ldap);
    if (!config) {
      throw new Error(
        "Укажите URL, Base DN, Bind DN и пароль сервисной учётной записи LDAP.",
      );
    }
    const result = await testConn(config);
    if (!result.ok) throw new Error(result.error);
    return { ok: true };
  });

export const testMailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ to: z.string().email() }))
  .handler(async ({ data, context }) => {
    await requireSystemSettingsAccess(context.supabase, context.userId);
    const { testMailDelivery } = await import("@/lib/email/send.server");
    const result = await testMailDelivery(data.to);
    if (!result.ok) throw new Error(result.error ?? "Не удалось отправить тестовое письмо");
    return { ok: true };
  });

export const testTelegramSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSystemSettingsAccess(context.supabase, context.userId);
    const settings = await loadSystemSettings();
    const { testTelegramBot } = await import("@/lib/telegram/send.server");

    if (settings.telegram.bot_token && !settings.telegram.enabled) {
      const verify = await fetch(
        `https://api.telegram.org/bot${settings.telegram.bot_token}/getMe`,
      );
      const payload = (await verify.json().catch(() => ({}))) as {
        ok?: boolean;
        description?: string;
      };
      if (!verify.ok || !payload.ok) {
        throw new Error(payload.description ?? "Неверный токен бота");
      }
      return { ok: true, message: "bot_verified" as const };
    }

    const result = await testTelegramBot();
    if (!result.ok) throw new Error(result.error ?? "Не удалось отправить тестовое сообщение");
    return { ok: true };
  });

export type { SystemSettingsResponse };
