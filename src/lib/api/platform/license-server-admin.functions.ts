import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateLicenseKey, hashLicenseKey } from "@/lib/license/keys.server";
import { PLAN_PRESETS } from "@/lib/license/plans";
import { getAppVersion } from "@/lib/license/server/config.server";
import {
  fetchLicenseServerOverview,
  listLicenseServerActivations,
  listLicenseServerKeys,
  listLicenseServerProvisions,
} from "@/lib/license/server/admin.server";
import {
  registerLicenseKeyOnServer,
  revokeOnLicenseServer,
  upsertProvisionOnServer,
} from "@/lib/license/server/registry.server";
import { requireVendorAdminSession } from "@/lib/license/server/vendor-local.server";
import { LICENSE_PLANS, type LicenseFeature } from "@/lib/license/types";

function guardVendorAdmin(): void {
  requireVendorAdminSession();
}

export const getLicenseServerAdminOverview = createServerFn({ method: "GET" }).handler(
  async () => {
    guardVendorAdmin();
    return fetchLicenseServerOverview(supabaseAdmin);
  },
);

export const listLicenseServerKeysFn = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
        status: z.enum(["active", "revoked", "all"]).optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    guardVendorAdmin();
    return listLicenseServerKeys(supabaseAdmin, data ?? {});
  });

export const listLicenseServerActivationsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
        status: z.enum(["active", "revoked", "all"]).optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    guardVendorAdmin();
    return listLicenseServerActivations(supabaseAdmin, data ?? {});
  });

export const listLicenseServerProvisionsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
        status: z.enum(["active", "revoked", "all"]).optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    guardVendorAdmin();
    return listLicenseServerProvisions(supabaseAdmin, data ?? {});
  });

export const provisionInstallationFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      plan: z.enum(LICENSE_PLANS),
      installation_id: z.string().uuid(),
      max_users: z.number().int().min(1).max(99999).optional(),
      customer: z.string().max(200).optional(),
      expires_at: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    guardVendorAdmin();
    const preset = PLAN_PRESETS[data.plan];
    const features = { ...preset.features } as Partial<Record<LicenseFeature, boolean>>;
    const result = await upsertProvisionOnServer(supabaseAdmin, {
      installation_id: data.installation_id,
      plan: data.plan,
      max_users: data.max_users ?? preset.max_users,
      features,
      customer_name: data.customer ?? "",
      expires_at: data.expires_at ?? null,
    });
    return { ok: true as const, ...result, plan: data.plan, max_users: data.max_users ?? preset.max_users };
  });

export const registerLicenseServerKeyFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ license_key: z.string().min(20) }))
  .handler(async ({ data }) => {
    guardVendorAdmin();
    const result = await registerLicenseKeyOnServer(supabaseAdmin, data.license_key.trim());
    return { ok: true as const, ...result };
  });

export const revokeLicenseServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      key_id: z.string().uuid().optional(),
      key_hash: z.string().min(16).optional(),
      installation_id: z.string().min(8).optional(),
      reason: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    guardVendorAdmin();
    if (!data.key_id && !data.key_hash && !data.installation_id) {
      throw new Error("Укажите key_id, key_hash или installation_id");
    }
    return revokeOnLicenseServer(supabaseAdmin, {
      key_id: data.key_id,
      key_hash: data.key_hash,
      installation_id: data.installation_id,
      reason: data.reason,
    });
  });

export const generateVendorLicenseKeyFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      plan: z.enum(LICENSE_PLANS),
      max_users: z.number().int().min(1).max(99999).optional(),
      customer: z.string().max(200).optional(),
      installation_id: z.string().uuid(),
      expires_at: z.string().nullable().optional(),
      auto_register: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    guardVendorAdmin();

    const preset = PLAN_PRESETS[data.plan];
    const features = { ...preset.features } as Partial<Record<LicenseFeature, boolean>>;

    const licenseKey = generateLicenseKey({
      plan: data.plan,
      max_users: data.max_users ?? preset.max_users,
      customer: data.customer ?? "",
      installation_id: data.installation_id,
      expires_at: data.expires_at,
      features,
    });

    const keyHash = hashLicenseKey(licenseKey);
    let keyId: string | null = null;

    if (data.auto_register !== false) {
      const registered = await registerLicenseKeyOnServer(supabaseAdmin, licenseKey);
      keyId = registered.key_id;
    }

    await upsertProvisionOnServer(supabaseAdmin, {
      installation_id: data.installation_id,
      plan: data.plan,
      max_users: data.max_users ?? preset.max_users,
      features,
      customer_name: data.customer ?? "",
      expires_at: data.expires_at ?? null,
    });

    return {
      license_key: licenseKey,
      key_hash: keyHash,
      key_id: keyId,
      plan: data.plan,
      max_users: data.max_users ?? preset.max_users,
      features,
      app_version: getAppVersion(),
    };
  });
