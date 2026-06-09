import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getInstallationId } from "@/lib/env.server";
import { ensureInstallationEnv } from "@/lib/installation.server";
import { fetchLicenseStatus } from "@/lib/license/enforcement";
import { hashLicenseKey, parseLicenseKey } from "@/lib/license/keys.server";
import type { LicenseStatusResponse } from "@/lib/license/types";
import { requirePermission } from "./_helpers";

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
};

async function buildSchemaMissingStatus(
  supabase: typeof supabaseAdmin,
  autoId: string,
): Promise<LicenseStatusResponse> {
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
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

    const { data, error } = await context.supabase.rpc("get_license_status" as never);
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

export const activateLicenseKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ license_key: z.string().min(20) }))
  .handler(async ({ data, context }) => {
    await requirePermission(supabaseAdmin, context.userId, "manage_license");
    ensureInstallationEnv();

    const payload = parseLicenseKey(data.license_key);
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
      license_key_hash: hashLicenseKey(data.license_key),
      installation_id: payload.installation_id ?? installationId ?? null,
      max_users: payload.max_users,
      features: payload.features,
      customer_name: payload.customer,
      issued_at: payload.issued_at,
      expires_at: payload.expires_at,
      activated_at: new Date().toISOString(),
      activated_by: context.userId,
    };

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("installation_license")
        .update(patch as never)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("installation_license")
        .insert(patch as never);
      if (error) throw new Error(error.message);
    }

    return fetchLicenseStatus(supabaseAdmin);
  });

export const setLicenseSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ suspended: z.boolean() }))
  .handler(async ({ data, context }) => {
    await requirePermission(supabaseAdmin, context.userId, "manage_license");
    const { data: result, error } = await supabaseAdmin.rpc("set_license_status" as never, {
      p_status: data.suspended ? "suspended" : "active",
    } as never);
    if (error) throw new Error(error.message);
    return result as LicenseStatusResponse;
  });

export const getInstallationInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePermission(supabaseAdmin, context.userId, "manage_license");
    ensureInstallationEnv();
    const installation_id = getInstallationId();
    const source = process.env.SUPABASE_PROJECT_REF?.trim()
      ? "supabase_project"
      : "persisted";
    return { installation_id, source };
  });
