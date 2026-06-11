import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  fetchLicenseServerOverview,
  listLicenseServerActivations,
  listLicenseServerKeys,
  listLicenseServerProvisions,
  listPortalClients,
} from "./lib/admin.server.js";
import {
  getVendorAdminIdentity,
  isVendorAdminFullyAuthenticated,
  requireVendorAdminSession,
  requireVendorStaffManager,
} from "./lib/vendor-admin-auth.js";
import {
  createVendorStaffUser,
  isVendorAdminUiConfigured,
  listVendorStaff,
  updateVendorStaff,
  type VendorStaffRole,
} from "./lib/vendor-staff.server.js";
import { bootstrapOwnerFromTelegramEnv } from "./lib/vendor-staff-bootstrap.server.js";
import { checkVendorTelegramWebhook, registerVendorTelegramWebhook } from "./lib/vendor-telegram-check.server.js";
import {
  clearVerifySessionCookie,
  getVerifyMethods,
  pollVerifyChallenge,
  setVerifySessionCookie,
  startVerifyChallenge,
  confirmVerifyChallenge,
} from "./lib/vendor-admin-verify.js";
import { getVendorApprovalSecret } from "./lib/vendor-admin-config.js";
import { requireAdmin } from "./lib/auth.js";
import { generateLicenseKey, hashLicenseKey } from "./lib/keys.js";
import { PLAN_PRESETS } from "./lib/plans.js";
import {
  registerLicenseKeyOnServer,
  revokeOnLicenseServer,
  upsertProvisionOnServer,
} from "./lib/registry.js";
import { getAppVersion, getSupabase } from "./lib/supabase.js";
import { LICENSE_PLANS } from "./lib/types.js";

const listQuerySchema = z.object({
  status: z.enum(["active", "revoked", "all"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const adminRoutes = new Hono();

adminRoutes.get("/session", async (c) => {
  const supabase = getSupabase();
  const configured = await isVendorAdminUiConfigured(supabase);
  const verify = await getVerifyMethods(supabase);
  const identity = await getVendorAdminIdentity(c.req.header("Authorization"));

  if (!configured || !identity) {
    return c.json({
      configured,
      authenticated: false,
      identity: null,
      step: configured ? "password" : "none",
      verify,
    });
  }

  const authenticated = await isVendorAdminFullyAuthenticated(c);
  return c.json({
    configured: true,
    authenticated,
    identity: {
      email: identity.email,
      full_name: identity.staff.full_name,
      role: identity.staff.role,
    },
    step: authenticated ? "ready" : "verify",
    verify,
  });
});

adminRoutes.post("/logout", (c) => {
  clearVerifySessionCookie(c);
  return c.json({ ok: true });
});

adminRoutes.get("/telegram/webhook/check", async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Unauthorized" }, 401);
  try {
    const result = await checkVendorTelegramWebhook();
    return c.json(result, result.ok ? 200 : 503);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

adminRoutes.post("/telegram/webhook/register", async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Unauthorized" }, 401);
  try {
    const result = await registerVendorTelegramWebhook();
    return c.json(result);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

adminRoutes.post("/verify/start", async (c) => {
  const supabase = getSupabase();
  if (!(await isVendorAdminUiConfigured(supabase))) {
    return c.json({ error: "Admin UI не настроен" }, 503);
  }
  const identity = await getVendorAdminIdentity(c.req.header("Authorization"));
  if (!identity) return c.json({ error: "Unauthorized" }, 401);

  const verify = await getVerifyMethods(supabase);
  if (!verify.required) {
    setVerifySessionCookie(c, identity.id);
    return c.json({ ok: true, skipped: true, verify });
  }

  try {
    const challenge = await startVerifyChallenge(getSupabase(), identity);
    return c.json({ ok: true, ...challenge, verify });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

adminRoutes.get("/verify/poll", async (c) => {
  const token = c.req.query("token")?.trim();
  if (!token) return c.json({ error: "token required" }, 400);

  const identity = await getVendorAdminIdentity(c.req.header("Authorization"));
  if (!identity) return c.json({ error: "Unauthorized" }, 401);

  const status = await pollVerifyChallenge(getSupabase(), token);
  if (status === "confirmed") {
    setVerifySessionCookie(c, identity.id);
    return c.json({ status, ok: true });
  }
  return c.json({ status, ok: false });
});

adminRoutes.get("/verify/approve", (c) =>
  c.json(
    {
      ok: false,
      message: "Это POST-endpoint для подтверждения step-up verify из внутренней системы.",
      usage: {
        method: "POST",
        content_type: "application/json",
        body: {
          challenge_token: "<из webhook-уведомления>",
          secret: "<LICENSE_SERVER_VENDOR_ADMIN_APPROVAL_SECRET>",
        },
      },
      note: "Для входа через Telegram webhook не нужен — подтвердите через vendor-бота.",
    },
    405,
  ),
);

adminRoutes.post(
  "/verify/approve",
  zValidator(
    "json",
    z.object({
      challenge_token: z.string().min(16),
      secret: z.string().min(8),
    }),
  ),
  async (c) => {
    const expected = getVendorApprovalSecret();
    if (!expected) return c.json({ error: "Webhook approval not configured" }, 503);

    const body = c.req.valid("json");
    if (body.secret !== expected) return c.json({ error: "Unauthorized" }, 401);

    const result = await confirmVerifyChallenge(getSupabase(), body.challenge_token, "webhook");
    if (!result.ok) return c.json({ error: result.error }, 400);
    return c.json({ ok: true, user_id: result.user_id });
  },
);


const staffRoleSchema = z.enum(["owner", "admin", "staff"]);

const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1).max(200).optional(),
  role: staffRoleSchema.optional(),
  telegram_chat_id: z.string().max(32).optional(),
});

const updateStaffSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  role: staffRoleSchema.optional(),
  telegram_chat_id: z.string().max(32).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

adminRoutes.post("/staff/bootstrap", async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Unauthorized" }, 401);
  try {
    const result = await bootstrapOwnerFromTelegramEnv(getSupabase());
    if (!result) {
      return c.json({
        ok: true,
        skipped: true,
        reason: "vendor_staff уже заполнен или LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS пуст",
      });
    }
    return c.json({
      ok: true,
      staff: result.staff,
      password_sent: result.password_sent,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

adminRoutes.get("/staff", async (c) => {
  const denied = await requireVendorAdminSession(c);
  if (denied) return denied;
  try {
    const items = await listVendorStaff(getSupabase());
    return c.json({ items, total: items.length });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

adminRoutes.post("/staff", zValidator("json", createStaffSchema), async (c) => {
  const denied = await requireVendorStaffManager(c);
  if (denied) return denied;
  const actor = await getVendorAdminIdentity(c.req.header("Authorization"));
  if (!actor) return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = c.req.valid("json");
    if (body.role === "owner" && actor.staff.role !== "owner") {
      return c.json({ error: "Только owner может назначать owner" }, 403);
    }
    const staff = await createVendorStaffUser(getSupabase(), actor.staff.id, {
      ...body,
      role: (body.role ?? "staff") as VendorStaffRole,
    });
    return c.json({ ok: true, staff });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

adminRoutes.patch("/staff/:id", zValidator("json", updateStaffSchema), async (c) => {
  const denied = await requireVendorStaffManager(c);
  if (denied) return denied;
  const actor = await getVendorAdminIdentity(c.req.header("Authorization"));
  if (!actor) return c.json({ error: "Unauthorized" }, 401);

  const staffId = c.req.param("id");
  const body = c.req.valid("json");

  if (body.role === "owner" && actor.staff.role !== "owner") {
    return c.json({ error: "Только owner может назначать owner" }, 403);
  }
  if (staffId === actor.staff.id && body.status === "disabled") {
    return c.json({ error: "Нельзя отключить собственный аккаунт" }, 400);
  }

  try {
    const staff = await updateVendorStaff(getSupabase(), staffId, body);
    return c.json({ ok: true, staff });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

adminRoutes.get("/overview", async (c) => {
  const denied = await requireVendorAdminSession(c);
  if (denied) return denied;
  try {
    return c.json(await fetchLicenseServerOverview(getSupabase()));
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

adminRoutes.get("/keys", async (c) => {
  const denied = await requireVendorAdminSession(c);
  if (denied) return denied;
  const query = listQuerySchema.safeParse({
    status: c.req.query("status"),
    limit: c.req.query("limit"),
  });
  try {
    return c.json(
      await listLicenseServerKeys(getSupabase(), query.success ? query.data : {}),
    );
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

adminRoutes.get("/activations", async (c) => {
  const denied = await requireVendorAdminSession(c);
  if (denied) return denied;
  const query = listQuerySchema.safeParse({
    status: c.req.query("status"),
    limit: c.req.query("limit"),
  });
  try {
    return c.json(
      await listLicenseServerActivations(getSupabase(), query.success ? query.data : {}),
    );
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

adminRoutes.get("/provisions", async (c) => {
  const denied = await requireVendorAdminSession(c);
  if (denied) return denied;
  const query = listQuerySchema.safeParse({
    status: c.req.query("status"),
    limit: c.req.query("limit"),
  });
  try {
    return c.json(
      await listLicenseServerProvisions(getSupabase(), query.success ? query.data : {}),
    );
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

adminRoutes.get("/clients", async (c) => {
  const denied = await requireVendorAdminSession(c);
  if (denied) return denied;
  const query = listQuerySchema.safeParse({ limit: c.req.query("limit") });
  try {
    return c.json(await listPortalClients(getSupabase(), query.success ? query.data : {}));
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

const provisionSchema = z.object({
  installation_id: z.string().uuid(),
  plan: z.enum(LICENSE_PLANS),
  max_users: z.number().int().min(1).max(99999).optional(),
  customer_name: z.string().max(200).optional(),
  expires_at: z.string().nullable().optional(),
});

adminRoutes.post("/provision", zValidator("json", provisionSchema), async (c) => {
  const denied = await requireVendorAdminSession(c);
  if (denied) return denied;
  try {
    const body = c.req.valid("json");
    const preset = PLAN_PRESETS[body.plan];
    const result = await upsertProvisionOnServer(getSupabase(), {
      installation_id: body.installation_id,
      plan: body.plan,
      max_users: body.max_users ?? preset.max_users,
      features: preset.features as Record<string, boolean>,
      customer_name: body.customer_name ?? "",
      expires_at: body.expires_at ?? null,
    });
    return c.json({ ok: true, ...result });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

adminRoutes.post(
  "/register-key",
  zValidator("json", z.object({ license_key: z.string().min(20) })),
  async (c) => {
    const denied = await requireVendorAdminSession(c);
    if (denied) return denied;
    try {
      const { license_key } = c.req.valid("json");
      const result = await registerLicenseKeyOnServer(getSupabase(), license_key.trim());
      return c.json({ ok: true, ...result });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  },
);

adminRoutes.post("/revoke", zValidator("json", z.object({
  key_id: z.string().uuid().optional(),
  installation_id: z.string().uuid().optional(),
  key_hash: z.string().min(16).optional(),
  reason: z.string().max(500).optional(),
})), async (c) => {
  const denied = await requireVendorAdminSession(c);
  if (denied) return denied;
  const body = c.req.valid("json");
  if (!body.key_id && !body.installation_id && !body.key_hash) {
    return c.json({ error: "key_id, installation_id or key_hash required" }, 400);
  }
  try {
    const result = await revokeOnLicenseServer(getSupabase(), body);
    return c.json({ ok: true, ...result });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

adminRoutes.post("/generate-key", zValidator("json", z.object({
  installation_id: z.string().uuid(),
  plan: z.enum(LICENSE_PLANS),
  max_users: z.number().int().min(1).max(99999).optional(),
  customer: z.string().max(200).optional(),
  expires_at: z.string().nullable().optional(),
})), async (c) => {
  const denied = await requireVendorAdminSession(c);
  if (denied) return denied;
  try {
    const body = c.req.valid("json");
    const preset = PLAN_PRESETS[body.plan];
    const licenseKey = generateLicenseKey({
      plan: body.plan,
      max_users: body.max_users ?? preset.max_users,
      customer: body.customer,
      installation_id: body.installation_id,
      expires_at: body.expires_at,
    });
    const registered = await registerLicenseKeyOnServer(getSupabase(), licenseKey);
    await upsertProvisionOnServer(getSupabase(), {
      installation_id: body.installation_id,
      plan: body.plan,
      max_users: body.max_users ?? preset.max_users,
      features: preset.features as Record<string, boolean>,
      customer_name: body.customer ?? "",
      expires_at: body.expires_at ?? null,
    });
    return c.json({
      ok: true,
      license_key: licenseKey,
      key_hash: hashLicenseKey(licenseKey),
      key_id: registered.key_id,
      app_version: getAppVersion(),
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
