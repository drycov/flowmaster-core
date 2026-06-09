import { redirect } from "@tanstack/react-router";
import { getMyProfile } from "@/lib/api/admin.functions";
import type { Permission } from "./permissions";

export async function requireAnyPermission(...permissions: Permission[]) {
  const me = await getMyProfile();
  if (me.roles.includes("admin")) return me;
  const hasAny = permissions.some((p) => me.permissions[p]);
  if (!hasAny) {
    throw redirect({ to: "/dashboard" });
  }
  return me;
}

export async function requireAdminOrPermission(permission: Permission) {
  return requireAnyPermission(permission);
}
