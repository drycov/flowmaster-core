import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAdmin } from "./lib/auth.js";
import { generateLicenseKey } from "./lib/keys.js";
import { PLAN_PRESETS } from "./lib/plans.js";
import { getPortalUserFromRequest } from "./lib/portal-auth.js";
import { bootstrapPortalAccount, buildPublicPlans, getPortalAccount } from "./lib/portal.js";
import { buildPricingConfig, calculateQuote, type BillingPeriod } from "./lib/pricing.js";
import { sanitizeUsageTelemetry } from "./lib/telemetry.js";
import {
  activateOnLicenseServer,
  connectOnLicenseServer,
  heartbeatOnLicenseServer,
  registerLicenseKeyOnServer,
  revokeOnLicenseServer,
  upsertProvisionOnServer,
} from "./lib/registry.js";
import { getAppVersion, getSupabase } from "./lib/supabase.js";
import { LICENSE_PLANS } from "./lib/types.js";
import { adminRoutes } from "./admin-routes.js";
import { handleTelegramWebhook } from "./lib/telegram-webhook.js";
import { ensureVendorOwnerBootstrapped } from "./lib/vendor-staff-bootstrap.server.js";

const installationIdSchema = z.string().uuid();
const connectSchema = z.object({
  installation_id: installationIdSchema,
  hostname: z.string().optional(),
  app_version: z.string().optional(),
});
const activateSchema = connectSchema.extend({
  license_key: z.string().min(20),
});
const usageTelemetrySchema = z
  .object({
    total_users: z.number().int().min(0).max(999_999).optional(),
    active_users: z.number().int().min(0).max(999_999).optional(),
    max_users_allowed: z.number().int().min(0).max(999_999).optional(),
    documents_total: z.number().int().min(0).max(99_999_999).optional(),
    documents_30d: z.number().int().min(0).max(99_999_999).optional(),
    workflows_published: z.number().int().min(0).max(999_999).optional(),
    app_version: z.string().max(64).optional(),
    environment: z.string().max(32).optional(),
    platform: z.string().max(64).optional(),
  })
  .strict()
  .optional();

const heartbeatSchema = z.object({
  token: z.string().min(10),
  installation_id: installationIdSchema,
  active_users: z.number().int().min(0).optional(),
  hostname: z.string().optional(),
  app_version: z.string().optional(),
  telemetry: usageTelemetrySchema,
});
const registerKeySchema = z.object({
  license_key: z.string().min(20),
});
const revokeSchema = z.object({
  key_id: z.string().uuid().optional(),
  installation_id: installationIdSchema.optional(),
  key_hash: z.string().min(16).optional(),
  reason: z.string().max(500).optional(),
});
const provisionSchema = z.object({
  installation_id: installationIdSchema,
  plan: z.enum(LICENSE_PLANS),
  max_users: z.number().int().min(1).max(99999).optional(),
  customer_name: z.string().max(200).optional(),
  expires_at: z.string().nullable().optional(),
});
const generateKeySchema = z.object({
  installation_id: installationIdSchema,
  plan: z.enum(LICENSE_PLANS),
  max_users: z.number().int().min(1).max(99999).optional(),
  customer: z.string().max(200).optional(),
  expires_at: z.string().nullable().optional(),
  auto_register: z.boolean().optional(),
});
const bootstrapSchema = z.object({
  company_name: z.string().min(2).max(200),
});
const pricingQuoteSchema = z.object({
  users: z.number().int().min(1).max(9999),
  period: z.enum(["monthly", "yearly"]),
  extended: z.boolean().optional(),
  integrations: z.boolean().optional(),
});

export const app = new Hono().basePath("/");

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin ?? "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);

app.use("/api/*", async (_c, next) => {
  try {
    await ensureVendorOwnerBootstrapped();
  } catch (err) {
    console.error("[vendor-staff] bootstrap:", err instanceof Error ? err.message : err);
  }
  await next();
});

app.route("/api/v1/admin", adminRoutes);

app.post("/api/v1/hooks/telegram", (c) => handleTelegramWebhook(c));

app.get("/api/v1/portal/plans", (c) => c.json({ plans: buildPublicPlans() }));

app.get("/api/v1/portal/pricing-config", (c) => c.json(buildPricingConfig()));

app.post("/api/v1/portal/pricing-quote", zValidator("json", pricingQuoteSchema), (c) => {
  const body = c.req.valid("json");
  return c.json({
    quote: calculateQuote({
      users: body.users,
      period: body.period as BillingPeriod,
      extended: body.extended,
      integrations: body.integrations,
    }),
  });
});

app.get("/api/v1/portal/me", async (c) => {
  const user = await getPortalUserFromRequest(c.req.header("authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const data = await getPortalAccount(getSupabase(), user.id);
    if (!data) return c.json({ account: null, installations: [] });
    return c.json(data);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.post("/api/v1/portal/bootstrap", zValidator("json", bootstrapSchema), async (c) => {
  const user = await getPortalUserFromRequest(c.req.header("authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const { company_name } = c.req.valid("json");
    const result = await bootstrapPortalAccount(getSupabase(), user, company_name);
    return c.json(result);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.get("/api/v1/license/health", async (c) => {
  try {
    const supabase = getSupabase();
    const [{ count: keyCount }, { count: actCount }] = await Promise.all([
      supabase.from("license_server_keys").select("id", { count: "exact", head: true }),
      supabase
        .from("license_server_activations")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

    return c.json({
      ok: true,
      role: "license-server",
      platform: "vercel",
      version: getAppVersion(),
      keys: keyCount ?? 0,
      active_activations: actCount ?? 0,
    });
  } catch {
    return c.json({ ok: false, role: "license-server", error: "database" }, 503);
  }
});

app.post("/api/v1/license/connect", zValidator("json", connectSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const result = await connectOnLicenseServer(getSupabase(), body);
    return c.json(result);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.post("/api/v1/license/activate", zValidator("json", activateSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const result = await activateOnLicenseServer(getSupabase(), body);
    return c.json(result);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.post("/api/v1/license/heartbeat", zValidator("json", heartbeatSchema), async (c) => {
  try {
    const body = c.req.valid("json");
    const telemetry = sanitizeUsageTelemetry(body.telemetry) ?? undefined;
    const result = await heartbeatOnLicenseServer(getSupabase(), {
      ...body,
      telemetry,
    });
    return c.json(result);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.post("/api/v1/license/register-key", zValidator("json", registerKeySchema), async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Unauthorized" }, 401);
  try {
    const { license_key } = c.req.valid("json");
    const result = await registerLicenseKeyOnServer(getSupabase(), license_key);
    return c.json({ ok: true, ...result });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.post("/api/v1/license/revoke", zValidator("json", revokeSchema), async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Unauthorized" }, 401);
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

app.post("/api/v1/license/provision", zValidator("json", provisionSchema), async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Unauthorized" }, 401);
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

app.post("/api/v1/license/generate-key", zValidator("json", generateKeySchema), async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Unauthorized" }, 401);
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

    let keyId: string | null = null;
    if (body.auto_register !== false) {
      const registered = await registerLicenseKeyOnServer(getSupabase(), licenseKey);
      keyId = registered.key_id;
    }

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
      key_id: keyId,
      plan: body.plan,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
