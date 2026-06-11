import { createServerFn } from "@tanstack/react-start";

import { z } from "zod";

import { getRequest } from "@tanstack/react-start/server";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  attachEdsToProfile,
  authenticateUser,
  consumeAuthChallenge,
  displayNameFromCert,
  edsEmail,
  enableEmailLoginForUser,
  ensureAdminRole,
  extractIin,
  fetchProfileById,
  findProfileByIin,
  issueAppSession,
  registerUser,
} from "@/lib/auth/server";

import {
  assertEdsRegistrationAllowed,
  assertEmailRegistrationAllowed,
  loadSystemSettings,
  validatePassword,
} from "@/lib/auth/policy";
import {
  assertUserBelongsToOrganization,
  resolveAuthOrganizationFromRequest,
} from "@/lib/access/tenant-auth.server";
import { applyBootstrapOrganizationSetup } from "@/lib/access/tenant-public.server";
import { clearAuthCookies, publishAuthSession } from "@/lib/auth/server/publish-session.server";
import { getRefreshSessionCookie } from "@/lib/auth/server/refresh-cookie.server";
import { refreshAccessTokenFromOpaque } from "@/lib/auth/server/sessions";

async function issueSessionForUser(userId: string, email: string) {
  const settings = await loadSystemSettings();
  const session = await issueAppSession(userId, email, settings.auth.session_ttl_hours);
  return publishAuthSession(session);
}

function readRequestHost(): string | null {
  const request = getRequest();
  return request?.headers?.get("host") ?? null;
}

async function resolveAuthOrganizationId(tenantSlug?: string | null): Promise<string | null> {
  return resolveAuthOrganizationFromRequest({
    tenantSlug,
    hostHeader: readRequestHost(),
  });
}

const certInfoSchema = z.object({
  subject: z.string().optional(),

  issuer: z.string().optional(),

  serial: z.string().optional(),

  iin: z
    .string()
    .regex(/^\d{12}$/)
    .optional(),

  bin: z.string().optional(),

  cn: z.string().optional(),
});

// ─── Email auth ─────────────────────────────────────────────────────────────

export const registerWithEmail = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email(),

      password: z.string().min(8),

      full_name_ru: z.string().min(1),

      full_name_kk: z.string().min(1),

      locale: z.enum(["ru", "kk"]).default("ru"),

      tenant_slug: z.string().optional(),

      org_name_ru: z.string().optional(),

      org_name_kk: z.string().optional(),
    }),
  )

  .handler(async ({ data }) => {
    const { settings: authPolicy, bootstrap } = await assertEmailRegistrationAllowed(data.email);
    const pwdErr = validatePassword(data.password, authPolicy);
    if (pwdErr) throw new Error(pwdErr);

    let organizationId: string | null = null;

    if (bootstrap) {
      await applyBootstrapOrganizationSetup(true, {
        slug: data.tenant_slug,
        org_name_ru: data.org_name_ru,
        org_name_kk: data.org_name_kk,
        full_name_ru: data.full_name_ru,
        full_name_kk: data.full_name_kk,
      });
    } else {
      organizationId = await resolveAuthOrganizationId(data.tenant_slug);
    }

    const userId = await registerUser({
      email: data.email,
      password: data.password,
      full_name_ru: data.full_name_ru,
      full_name_kk: data.full_name_kk,
      locale: data.locale,
      auth_method: "email",
      organization_id: organizationId,
    });

    return issueSessionForUser(userId, data.email.toLowerCase());
  });

export const loginWithEmail = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email(),

      password: z.string().min(1),

      tenant_slug: z.string().optional(),
    }),
  )

  .handler(async ({ data }) => {
    const organizationId = await resolveAuthOrganizationId(data.tenant_slug);

    const row = await authenticateUser(data.email, data.password);

    await assertUserBelongsToOrganization(row.user_id, organizationId);

    return issueSessionForUser(row.user_id, row.email);
  });

export const loginWithLdap = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      username: z.string().min(1).max(255),
      password: z.string().min(1),
      tenant_slug: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const settings = await loadSystemSettings();
    if (!settings.ldap.enabled) {
      throw new Error("Вход через Active Directory отключён.");
    }

    const organizationId = await resolveAuthOrganizationId(data.tenant_slug);

    const { authenticateLdapUser, buildLdapRuntimeConfig } = await import("@/lib/auth/ldap.server");
    const { resolveLdapLogin } = await import("@/lib/auth/server/ldap-users.server");

    const config = buildLdapRuntimeConfig(settings.ldap);
    if (!config) {
      throw new Error(
        "LDAP не настроен. Укажите параметры подключения и пароль сервисной учётной записи в настройках системы.",
      );
    }

    const ldapUser = await authenticateLdapUser(data.username, data.password, config);
    if (!ldapUser) {
      throw new Error("Неверное имя пользователя или пароль Active Directory.");
    }

    const { userId, email } = await resolveLdapLogin(ldapUser, settings, { organizationId });
    return issueSessionForUser(userId, email);
  });

// ─── EDS auth ───────────────────────────────────────────────────────────────

export const createAuthChallenge = createServerFn({ method: "POST" })
  .inputValidator(z.object({ purpose: z.enum(["login", "register", "link"]) }))

  .handler(async ({ data }) => {
    const nonce = crypto.randomUUID();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: row, error } = await supabaseAdmin

      .from("auth_challenges" as never)

      .insert({ nonce, purpose: data.purpose, expires_at: expiresAt } as never)

      .select("id, nonce, expires_at")

      .single();

    if (error) throw new Error(error.message);

    const ch = row as { id: string; nonce: string; expires_at: string };

    const challengeB64 = Buffer.from(
      JSON.stringify({ nonce: ch.nonce, purpose: data.purpose, exp: ch.expires_at, app: "esedo" }),
    ).toString("base64");

    return { challenge_id: ch.id, challenge_b64: challengeB64, expires_at: ch.expires_at };
  });

export const completeEdsAuth = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      challenge_id: z.string().uuid(),

      signature: z.string().min(10),

      cert_info: certInfoSchema,

      full_name_ru: z.string().optional(),

      full_name_kk: z.string().optional(),

      link_email: z.preprocess(
        (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
        z.string().trim().email().optional(),
      ),

      link_password: z.preprocess(
        (val) => (typeof val === "string" && val === "" ? undefined : val),
        z.string().min(1).optional(),
      ),

      tenant_slug: z.string().optional(),

      org_name_ru: z.string().optional(),

      org_name_kk: z.string().optional(),
    }),
  )

  .handler(async ({ data }) => {
    const settings = await loadSystemSettings();
    const { verifyEdsAuthSignature } = await import("@/lib/auth/server/eds-auth-verify");
    const { certInfo, iin } = verifyEdsAuthSignature(data.signature, settings.eds, data.cert_info);

    const ch = await consumeAuthChallenge(data.challenge_id);

    const displayName = displayNameFromCert(certInfo, data.full_name_ru);

    const linkCreds =
      data.link_email && data.link_password
        ? { email: data.link_email, password: data.link_password }
        : null;

    let existing = await findProfileByIin(iin);

    let userId = existing?.id;

    let profileEmail = existing?.email;

    let isNewUser = false;

    if (ch.purpose === "login") {
      if (!userId) {
        const { data: byEmail } = await supabaseAdmin

          .from("profiles")

          .select("id, email")

          .eq("email", edsEmail(iin))

          .maybeSingle();

        if (byEmail) {
          userId = byEmail.id as string;

          profileEmail = byEmail.email as string;
        }
      }

      if (!userId && linkCreds) {
        const row = await authenticateUser(linkCreds.email, linkCreds.password);

        const profile = await fetchProfileById(row.user_id);

        if (profile?.iin && profile.iin !== iin) {
          throw new Error("К этому аккаунту уже привязан другой ИИН");
        }

        await attachEdsToProfile(row.user_id, iin, certInfo, displayName);

        userId = row.user_id;

        profileEmail = row.email;
      }

      if (!userId) {
        throw new Error(
          "Пользователь с данным сертификатом не зарегистрирован. Войдите по email и привяжите ЭЦП в профиле, либо укажите email и пароль существующего аккаунта.",
        );
      }

      await attachEdsToProfile(userId, iin, certInfo, displayName);

      const refreshed = await findProfileByIin(iin);

      profileEmail = refreshed?.email ?? profileEmail;
    } else if (ch.purpose === "register") {
      if (userId) {
        throw new Error("Пользователь с данным ИИН уже зарегистрирован. Войдите по ЭЦП.");
      }

      if (!linkCreds) {
        await assertEdsRegistrationAllowed();
      }

      if (linkCreds) {
        const row = await authenticateUser(linkCreds.email, linkCreds.password);

        const profile = await fetchProfileById(row.user_id);

        if (profile?.iin) {
          throw new Error("К этому аккаунту уже привязан ЭЦП");
        }

        await attachEdsToProfile(row.user_id, iin, certInfo, displayName);

        userId = row.user_id;

        profileEmail = row.email;
      } else {
        const { bootstrap } = await assertEdsRegistrationAllowed();

        await applyBootstrapOrganizationSetup(bootstrap, {
          slug: data.tenant_slug,
          org_name_ru: data.org_name_ru,
          org_name_kk: data.org_name_kk,
          full_name_ru: displayName,
          full_name_kk: data.full_name_kk || displayName,
        });

        userId = await registerUser({
          email: edsEmail(iin),

          password: `${crypto.randomUUID()}Aa1!`,

          full_name_ru: displayName,

          full_name_kk: data.full_name_kk || displayName,

          locale: "ru",

          iin,

          auth_method: "eds",
        });

        await ensureAdminRole(userId, "eds_first_user");

        await attachEdsToProfile(userId, iin, certInfo, displayName);

        profileEmail = edsEmail(iin);

        isNewUser = true;
      }
    } else {
      throw new Error("Для привязки ЭЦП используйте раздел безопасности в профиле");
    }

    if (ch.purpose === "login" || (ch.purpose === "register" && linkCreds)) {
      const organizationId = await resolveAuthOrganizationId(data.tenant_slug);
      await assertUserBelongsToOrganization(userId!, organizationId);
    }

    const session = await issueSessionForUser(userId!, profileEmail!);

    return { ...session, iin, is_new_user: isNewUser };
  });

export const linkEdsToProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])

  .inputValidator(
    z.object({
      challenge_id: z.string().uuid(),

      signature: z.string().min(10),

      cert_info: certInfoSchema,
    }),
  )

  .handler(async ({ data, context }) => {
    const settings = await loadSystemSettings();
    const { verifyEdsAuthSignature } = await import("@/lib/auth/server/eds-auth-verify");
    const { certInfo, iin } = verifyEdsAuthSignature(data.signature, settings.eds, data.cert_info);

    await consumeAuthChallenge(data.challenge_id, "link");

    const profile = await fetchProfileById(context.userId);

    if (!profile) throw new Error("Профиль не найден");

    if (profile.iin) {
      throw new Error("К вашему аккаунту уже привязан ЭЦП");
    }

    await attachEdsToProfile(context.userId, iin, certInfo, undefined, { verifyCn: true });

    return { ok: true, iin };
  });

export const enableEmailLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])

  .inputValidator(
    z.object({
      email: z.string().email(),

      password: z.string().min(8),
    }),
  )

  .handler(async ({ data, context }) => {
    await enableEmailLoginForUser(context.userId, data.email, data.password);

    return { ok: true };
  });

// ─── Session & profile ──────────────────────────────────────────────────────

export const logout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])

  .handler(async ({ context }) => {
    const { revokeAppSession, revokeAllUserSessions } = await import("@/lib/auth/server/sessions");
    const sid = context.claims?.sid;
    if (sid) {
      await revokeAppSession(sid);
    } else {
      await revokeAllUserSessions(context.userId);
    }

    clearAuthCookies();
    return { ok: true };
  });

export const refreshAccessToken = createServerFn({ method: "POST" }).handler(async () => {
  const refreshToken = getRefreshSessionCookie();
  if (!refreshToken) {
    throw new Error("No refresh session");
  }
  return refreshAccessTokenFromOpaque(refreshToken);
});

export const getCurrentSession = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();

  const authHeader = request?.headers?.get("authorization");

  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return { user: null };

  const { getJwtSecret, verifyAccessToken } = await import("@/lib/auth/session.server");
  const claims = verifyAccessToken(token, getJwtSecret());

  if (!claims) return { user: null };

  if (claims.sid) {
    const { validateActiveSession } = await import("@/lib/auth/server/sessions");
    const active = await validateActiveSession(claims.sid);
    if (!active) return { user: null };
  }

  const { data: profile } = await supabaseAdmin

    .from("profiles")

    .select("id, email, full_name_ru, full_name_kk")

    .eq("id", claims.sub)

    .maybeSingle();

  if (!profile) return { user: null };

  return { user: profile };
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])

  .inputValidator(
    z.object({
      full_name_ru: z.string().optional(),

      full_name_kk: z.string().optional(),

      phone: z.string().optional().nullable(),

      avatar_url: z.string().url().optional().nullable(),
    }),
  )

  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (data.full_name_ru !== undefined) patch.full_name_ru = data.full_name_ru || null;

    if (data.full_name_kk !== undefined) patch.full_name_kk = data.full_name_kk || null;

    if (data.phone !== undefined) patch.phone = data.phone;

    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;

    const { error } = await supabaseAdmin

      .from("profiles")

      .update(patch as never)

      .eq("id", context.userId);

    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])

  .inputValidator(z.object({ password: z.string().min(8) }))

  .handler(async ({ data, context }) => {
    const authPolicy = (await loadSystemSettings()).auth;
    const pwdErr = validatePassword(data.password, authPolicy);
    if (pwdErr) throw new Error(pwdErr);

    const { error } = await supabaseAdmin.rpc(
      "change_app_user_password" as never,
      {
        p_user_id: context.userId,
        p_new_password: data.password,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
