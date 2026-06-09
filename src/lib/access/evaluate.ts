import type { LicenseStatusResponse } from "@/lib/license/types";
import { hasLicenseFeature, isLicenseWritable } from "@/lib/license/enforcement";
import { getModule } from "./modules/registry";
import type { Permission } from "./permissions";
import { userHasAnyPermission } from "./rbac";
import type {
  ModuleAccessContext,
  ModuleAccessResult,
  ModuleAction,
  ModuleId,
  UserAccessSnapshot,
} from "./types";

function permissionsForAction(
  moduleId: ModuleId,
  action: ModuleAction,
): readonly Permission[] {
  const mod = getModule(moduleId);
  const perms = mod.permissions[action];
  if (perms?.length) return perms;
  if (action === "write" || action === "manage") {
    const read = mod.permissions.read;
    if (read?.length) return read;
  }
  if (action === "manage") {
    const write = mod.permissions.write;
    if (write?.length) return write;
  }
  return [];
}

export function evaluateModuleAccess(
  ctx: ModuleAccessContext,
  moduleId: ModuleId,
  action: ModuleAction = "read",
): ModuleAccessResult {
  const mod = getModule(moduleId);

  if (mod.licenseFeature) {
    const requireWritable =
      action !== "read" && mod.requireWritableForWrite !== false;
    if (!hasLicenseFeature(ctx.license, mod.licenseFeature, { requireWritable })) {
      return {
        allowed: false,
        reason: requireWritable && ctx.license && !ctx.license.is_writable ? "writable" : "license",
      };
    }
  } else if (
    action !== "read" &&
    mod.requireWritableForWrite !== false &&
    ctx.license &&
    !isLicenseWritable(ctx.license)
  ) {
    return { allowed: false, reason: "writable" };
  }

  const perms = permissionsForAction(moduleId, action);
  if (!userHasAnyPermission(ctx.user, perms)) {
    return { allowed: false, reason: "permission" };
  }

  return { allowed: true };
}

export function canAccessModule(
  user: UserAccessSnapshot,
  license: LicenseStatusResponse | undefined,
  moduleId: ModuleId,
  action: ModuleAction = "read",
  tenantId: string | null = null,
): boolean {
  return evaluateModuleAccess({ user, license, tenantId }, moduleId, action).allowed;
}

export function canAccessModuleFeature(
  license: LicenseStatusResponse | undefined,
  moduleId: ModuleId,
  requireWritable = false,
): boolean {
  const mod = getModule(moduleId);
  if (!mod.licenseFeature) return true;
  return hasLicenseFeature(license, mod.licenseFeature, { requireWritable });
}
