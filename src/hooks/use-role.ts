import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/admin.functions";
import type { Permission } from "@/lib/auth/permissions";
import { userHasPermission } from "@/lib/access/rbac";

export type { Permission };

export function useRole() {
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
    staleTime: 1000 * 60 * 5,
  });

  const roles = data?.roles ?? [];
  const permissions = data?.permissions ?? {};

  const can = (permission: Permission) => userHasPermission({ permissions }, permission);

  const hasRole = (role: string) => roles.includes(role as never);

  const isAdmin = !!permissions.manage_users;

  return {
    roles,
    permissions,
    can,
    hasRole,
    isAdmin,
    isLoading,
    profile: data?.profile,
  };
}
