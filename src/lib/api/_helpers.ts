import type { SupabaseClient } from "@supabase/supabase-js";
import { ALL_PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import {
  enforceLicense,
  requireAvailableSeat,
  requireLicenseFeature,
  requireLicenseFeatureAccess,
  requireWritableLicense,
} from "@/lib/license/enforcement";
import type { LicenseFeature } from "@/lib/license/types";

export {
  enforceLicense,
  requireWritableLicense,
  requireLicenseFeature,
  requireLicenseFeatureAccess,
  requireAvailableSeat,
};

export async function requirePermission(
  supabase: SupabaseClient,
  userId: string,
  permission: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("user_has_permission" as never, {
    _user: userId,
    _permission: permission,
  } as never);
  if (error) throw new Error(`Permission check failed: ${error.message}`);
  if (!data) throw new Error(`Forbidden: missing permission "${permission}"`);
}

export async function requireAnyPermission(
  supabase: SupabaseClient,
  userId: string,
  permissions: string[],
): Promise<void> {
  for (const p of permissions) {
    const { data, error } = await supabase.rpc("user_has_permission" as never, {
      _user: userId,
      _permission: p,
    } as never);
    if (error) throw new Error(`Permission check failed: ${error.message}`);
    if (data) return;
  }
  throw new Error(`Forbidden: missing one of [${permissions.join(", ")}]`);
}

export async function fetchUserPermissions(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<Permission, boolean>> {
  const result = {} as Record<Permission, boolean>;
  await Promise.all(
    ALL_PERMISSIONS.map(async (code) => {
      const { data, error } = await supabase.rpc("user_has_permission" as never, {
        _user: userId,
        _permission: code,
      } as never);
      if (error) throw new Error(`Permission check failed: ${error.message}`);
      result[code] = !!data;
    }),
  );
  return result;
}

export async function requireAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
  await requirePermission(supabase, userId, "manage_users");
}
