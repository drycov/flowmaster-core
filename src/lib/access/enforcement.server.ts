import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enforceLicense,
  requireLicenseFeature,
  requireLicenseFeatureAccess,
  requireWritableLicense,
  requireAvailableSeat,
} from "@/lib/license/enforcement";
import type { LicenseFeature } from "@/lib/license/types";
import { getModule } from "./modules/registry";
import type { ModuleAction, ModuleId } from "./types";
import { requireAnyPermission } from "./rbac.server";

export type ModuleEnforcementOpts = {
  action?: ModuleAction;
  /** Override: check seats when provisioning users. */
  seats?: boolean;
};

/**
 * Unified server-side gate: RBAC permission + license module + writable state.
 */
export async function requireModuleAccess(
  supabase: SupabaseClient,
  userId: string,
  moduleId: ModuleId,
  opts: ModuleEnforcementOpts = {},
): Promise<void> {
  const action = opts.action ?? "write";
  const mod = getModule(moduleId);

  if (opts.seats) {
    await requireAvailableSeat(supabase);
  }

  if (mod.licenseFeature) {
    if (action === "read") {
      await requireLicenseFeatureAccess(supabase, mod.licenseFeature, false);
    } else {
      await requireLicenseFeature(supabase, mod.licenseFeature);
    }
  } else if (action !== "read" && mod.requireWritableForWrite !== false) {
    await requireWritableLicense(supabase);
  }

  const perms =
    mod.permissions[action] ??
    (action === "manage"
      ? mod.permissions.write ?? mod.permissions.read
      : action === "write"
        ? mod.permissions.read
        : undefined);

  if (perms?.length) {
    await requireAnyPermission(supabase, userId, [...perms]);
  }
}

/** Shorthand for legacy enforceLicense + permission pairs. */
export async function enforceModuleLicense(
  supabase: SupabaseClient,
  moduleId: ModuleId,
  action: ModuleAction = "write",
): Promise<void> {
  const mod = getModule(moduleId);
  const opts: Parameters<typeof enforceLicense>[1] = {};

  if (mod.licenseFeature) {
    if (action === "read") {
      opts.featureRead = mod.licenseFeature;
    } else {
      opts.writable = true;
      opts.feature = mod.licenseFeature;
    }
  } else if (action !== "read" && mod.requireWritableForWrite !== false) {
    opts.writable = true;
  }

  await enforceLicense(supabase, opts);
}

export function moduleLicenseFeature(moduleId: ModuleId): LicenseFeature | undefined {
  return getModule(moduleId).licenseFeature;
}

export {
  enforceLicense,
  requireAvailableSeat,
  requireLicenseFeature,
  requireLicenseFeatureAccess,
  requireWritableLicense,
} from "@/lib/license/enforcement";

export { LicenseError, isLicenseError } from "@/lib/license/enforcement";
