import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  fetchLicenseServerOverview,
  listLicenseServerActivations,
  listLicenseServerKeys,
  listLicenseServerProvisions,
} from "./lib/admin.server.js";
import {
  clearAdminSessionCookie,
  createAdminSessionToken,
  hasAdminSession,
  requireAdminSession,
  setAdminSessionCookie,
} from "./lib/admin-session.js";
import { generateLicenseKey, hashLicenseKey } from "./lib/keys.js";
import { PLAN_PRESETS } from "./lib/plans.js";
import {
  registerLicenseKeyOnServer,
  revokeOnLicenseServer,
  upsertProvisionOnServer,
} from "./lib/registry.js";
import { getAdminSecret, verifyVendorSupportCode } from "./lib/support-code.js";
import { getAppVersion, getSupabase } from "./lib/supabase.js";
import { LICENSE_PLANS } from "./lib/types.js";

const loginSchema = z.object({
  support_code: z.string().min(8).max(12),
});

const listQuerySchema = z.object({
  status: z.enum(["active", "revoked", "all"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const adminRoutes = new Hono();

adminRoutes.get("/session", (c) => {
  const configured = !!getAdminSecret();
  return c.json({ configured, authenticated: configured && hasAdminSession(c) });
});

adminRoutes.post("/login", zValidator("json", loginSchema), (c) => {
  const secret = getAdminSecret();
  if (!secret) {
    return c.json({ error: "LICENSE_SERVER_ADMIN_SECRET не задан" }, 503);
  }
  const { support_code } = c.req.valid("json");
  if (!verifyVendorSupportCode(secret, support_code)) {
    return c.json({ error: "Неверный или просроченный support code" }, 401);
  }
  const token = createAdminSessionToken();
  setAdminSessionCookie(c, token);
  return c.json({ ok: true });
});

adminRoutes.post("/logout", (c) => {
  clearAdminSessionCookie(c);
  return c.json({ ok: true });
});

adminRoutes.get("/overview", async (c) => {
  const denied = requireAdminSession(c);
  if (denied) return denied;
  try {
    return c.json(await fetchLicenseServerOverview(getSupabase()));
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

adminRoutes.get("/keys", async (c) => {
  const denied = requireAdminSession(c);
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
  const denied = requireAdminSession(c);
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
  const denied = requireAdminSession(c);
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

const provisionSchema = z.object({
  installation_id: z.string().uuid(),
  plan: z.enum(LICENSE_PLANS),
  max_users: z.number().int().min(1).max(99999).optional(),
  customer_name: z.string().max(200).optional(),
  expires_at: z.string().nullable().optional(),
});

adminRoutes.post("/provision", zValidator("json", provisionSchema), async (c) => {
  const denied = requireAdminSession(c);
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
    const denied = requireAdminSession(c);
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
  const denied = requireAdminSession(c);
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
  const denied = requireAdminSession(c);
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
