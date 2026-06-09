import { redirect } from "@tanstack/react-router";
import { getMyProfile } from "@/lib/api/admin.functions";
import { getLicenseStatus } from "@/lib/api/license.functions";
import { canAccessModule } from "./evaluate";
import { findModuleByPath } from "./modules/registry";
import type { ModuleAction, ModuleId } from "./types";
import type { Permission } from "./permissions";
import { userHasAnyPermission } from "./rbac";

export async function requireModule(moduleId: ModuleId, action: ModuleAction = "read") {
  const [me, license] = await Promise.all([getMyProfile(), getLicenseStatus()]);
  const user = {
    roles: me.roles,
    permissions: me.permissions,
  };

  if (!canAccessModule(user, license, moduleId, action)) {
    throw redirect({ to: "/dashboard" });
  }

  return { me, license };
}

/** Resolve module from URL and enforce registry action (longest prefix match). */
export async function requireModuleForPath(pathname: string) {
  const match = findModuleByPath(pathname);
  if (!match) return undefined;
  return requireModule(match.module.id, match.action);
}

/** @deprecated Use requireModule(moduleId) — kept for incremental migration. */
export async function requireLicenseModule(moduleId: ModuleId) {
  return requireModule(moduleId, "read");
}

export async function requireAnyPermission(...permissions: Permission[]) {
  const me = await getMyProfile();
  const user = {
    roles: me.roles,
    permissions: me.permissions,
  };
  if (!userHasAnyPermission(user, permissions)) {
    throw redirect({ to: "/dashboard" });
  }
  return me;
}

export async function requireAdminOrPermission(permission: Permission) {
  return requireAnyPermission(permission);
}
