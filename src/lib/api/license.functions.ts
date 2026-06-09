import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getInstallationId } from "@/lib/env.server";
import { ensureInstallationEnv } from "@/lib/installation.server";
import { fetchLicenseStatus } from "@/lib/license/enforcement";
import { hashLicenseKey, parseLicenseKey } from "@/lib/license/keys.server";
import {
  activateWithLicenseServer,
  licenseServerAvailable,
  syncLicenseWithServer,
} from "@/lib/license/server/client.server";
import { getLicenseMode, isOnlineLicenseRequired } from "@/lib/license/server/config.server";
import type { LicenseStatusResponse } from "@/lib/license/types";
import { requireModuleAccess } from "./_helpers";

function isLicenseSchemaMissing(message: string): boolean {
  return (
    message.includes("installation_license") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("PGRST205") ||
      message.includes("get_license_status"))
  );
}

const SCHEMA_MISSING_STATUS: LicenseStatusResponse = {
  has_license: false,
  plan: "trial",
  status: "expired",
  max_users: 0,
  active_users: 0,
  seats_available: 0,
  features: {},
  is_writable: false,
  days_remaining: 0,
  grace_days_remaining: 0,
  expires_at: null,
  customer_name: "",
  installation_id: null,
  grace_days: 14,
  activated_at: null,
  activation_mode: "offline",
  last_sync_at: null,
  last_sync_ok: false,
  last_sync_error: "",
  server_revoked: false,
  sync_stale: false,
  offline_grace_hours: 72,
  sync_interval_hours: 6,
};

async function buildSchemaMissingStatus(
  supabase: typeof supabaseAdmin,
  autoId: string,
): Promise<LicenseStatusResponse> {
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  return {
    ...SCHEMA_MISSING_STATUS,
    installation_id: autoId || null,
    active_users: count ?? 0,
  };
}

export const getLicenseStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    ensureInstallationEnv();
    const autoId = getInstallationId();

    const { data, error } = await supabaseAdmin.rpc("get_license_status" as never);
    if (error) {
      if (isLicenseSchemaMissing(error.message)) {
        return buildSchemaMissingStatus(context.supabase, autoId);
      }
      throw new Error(error.message);
    }

    const status = data as LicenseStatusResponse;
    if (!status.installation_id && autoId) {
      const { error: syncErr } = await supabaseAdmin
        .from("installation_license")
        .update({ installation_id: autoId } as never)
        .is("installation_id", null);
      if (!syncErr) status.installation_id = autoId;
    }
    return status;
  });

function validateKeyPayload(payload: ReturnType<typeof parseLicenseKey>): void {
  if (payload.expires_at) {
    const exp = new Date(payload.expires_at).getTime();
    if (Number.isNaN(exp) || exp < Date.now()) {
      throw new Error("Срок действия лицензионного ключа уже истёк");
    }
  }
}

async function activateLicenseOffline(
  licenseKey: string,
  userId: string,
): Promise<LicenseStatusResponse> {
  const payload = parseLicenseKey(licenseKey);
  validateKeyPayload(payload);

  const installationId = getInstallationId();
  if (payload.installation_id && installationId && payload.installation_id !== installationId) {
    throw new Error("Ключ привязан к другой установке (installation_id не совпадает)");
  }

  const { data: existing, error: loadErr } = await supabaseAdmin
    .from("installation_license")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (loadErr) {
    if (isLicenseSchemaMissing(loadErr.message)) {
      throw new Error("Таблица лицензирования не создана. Выполните: npx supabase db push");
    }
    throw new Error(loadErr.message);
  }

  const patch = {
    plan: payload.plan,
    status: "active",
    license_key_hash: hashLicenseKey(licenseKey),
    installation_id: payload.installation_id ?? installationId ?? null,
    max_users: payload.max_users,
    features: payload.features,
    customer_name: payload.customer,
    issued_at: payload.issued_at,
    expires_at: payload.expires_at,
    activated_at: new Date().toISOString(),
    activated_by: userId,
    activation_mode: "offline",
    license_server_token: null,
    license_key_id: null,
    last_sync_at: null,
    last_sync_ok: false,
    last_sync_error: "",
    server_revoked: false,
  };

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("installation_license")
      .update(patch as never)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin.from("installation_license").insert(patch as never);
    if (error) throw new Error(error.message);
  }

  return fetchLicenseStatus(supabaseAdmin);
}

export const activateLicenseKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ license_key: z.string().min(20) }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_license", { action: "manage" });
    ensureInstallationEnv();

    const installationId = getInstallationId();
    const mode = getLicenseMode();

    if (mode === "online") {
      if (!licenseServerAvailable()) {
        throw new Error("LICENSE_MODE=online требует LICENSE_SERVER_URL");
      }
      return activateWithLicenseServer(data.license_key, installationId, context.userId);
    }

    if (mode === "hybrid" && licenseServerAvailable()) {
      try {
        return await activateWithLicenseServer(data.license_key, installationId, context.userId);
      } catch {
        return activateLicenseOffline(data.license_key, context.userId);
      }
    }

    if (isOnlineLicenseRequired()) {
      throw new Error("Онлайн-активация обязательна, но license server не настроен");
    }

    return activateLicenseOffline(data.license_key, context.userId);
  });

export const syncLicenseNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_license", { action: "manage" });
    if (!licenseServerAvailable()) {
      throw new Error("LICENSE_SERVER_URL не задан");
    }
    return syncLicenseWithServer(supabaseAdmin);
  });

export const getLicenseServerConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_license", { action: "manage" });
    return {
      mode: getLicenseMode(),
      server_configured: licenseServerAvailable(),
      server_url: process.env.LICENSE_SERVER_URL?.trim() || null,
    };
  });

export const setLicenseSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ suspended: z.boolean() }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_license", { action: "manage" });
    const { data: result, error } = await supabaseAdmin.rpc(
      "set_license_status" as never,
      {
        p_status: data.suspended ? "suspended" : "active",
      } as never,
    );
    if (error) throw new Error(error.message);
    return result as LicenseStatusResponse;
  });

export const getInstallationInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_license", { action: "manage" });
    ensureInstallationEnv();
    const installation_id = getInstallationId();
    const source = process.env.SUPABASE_PROJECT_REF?.trim() ? "supabase_project" : "persisted";
    return { installation_id, source };
  });
