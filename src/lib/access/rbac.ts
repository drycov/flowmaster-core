import type { Permission } from "./permissions";

export type AccessUser = {
  permissions: Partial<Record<Permission, boolean>>;
};

export function userHasPermission(user: AccessUser, permission: Permission): boolean {
  return !!user.permissions[permission];
}

export function userHasAnyPermission(
  user: AccessUser,
  permissions: readonly Permission[],
): boolean {
  if (permissions.length === 0) return true;
  return permissions.some((p) => user.permissions[p]);
}

export function userCanManageSystemSettings(user: AccessUser): boolean {
  return userHasAnyPermission(user, ["manage_system_settings", "manage_license"]);
}

export function userCanManageIntegrations(user: AccessUser): boolean {
  return userHasAnyPermission(user, ["manage_integrations", "manage_license"]);
}
