import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/admin.functions";

export type Permission = 
  | "manage_users"
  | "manage_org"
  | "manage_workflows"
  | "manage_templates"
  | "manage_nomenclature"
  | "view_audit"
  | "sign_documents"
  | "register_documents"
  | "approve_documents"
  | "archive_documents";

export function useRole() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const roles = data?.roles ?? [];
  const permissions = data?.permissions ?? {};

  const can = (permission: Permission) => {
    if (roles.includes("admin")) return true;
    return !!permissions[permission];
  };

  const hasRole = (role: string) => {
    return roles.includes(role as any);
  };

  const isAdmin = roles.includes("admin");

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
