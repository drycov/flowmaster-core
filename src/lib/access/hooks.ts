import { useQuery } from "@tanstack/react-query";
import { getLicenseStatus } from "@/lib/api/license.functions";
import { getMyProfile } from "@/lib/api/admin.functions";
import { hasLicenseFeature, isLicenseWritable } from "@/lib/license/enforcement";
import type { LicenseFeature } from "@/lib/license/types";
import { canAccessModule, canAccessModuleFeature } from "./evaluate";
import { getModule, listLicensedModules } from "./modules/registry";
import type { ModuleAction, ModuleId } from "./types";
import type { Permission } from "./permissions";
import { userHasAnyPermission, userHasPermission } from "./rbac";
import { resolveTenantContext, tenantScopeKey } from "./tenant";

export function useAccessContext() {
  const tenantQuery = useQuery({
    queryKey: ["tenant-context"],
    queryFn: resolveTenantContext,
    staleTime: Infinity,
  });

  const tenantKey = tenantScopeKey(tenantQuery.data ?? { id: null, name: null, mode: "single" });

  const meQuery = useQuery({
    queryKey: ["me", tenantKey],
    queryFn: () => getMyProfile(),
  });

  const licenseQuery = useQuery({
    queryKey: ["license-status", tenantKey],
    queryFn: getLicenseStatus,
    staleTime: 60_000,
  });

  const me = meQuery.data;
  const license = licenseQuery.data;
  const user = {
    roles: me?.roles ?? [],
    permissions: me?.permissions ?? {},
  };

  const canModule = (moduleId: ModuleId, action: ModuleAction = "read") =>
    canAccessModule(user, license, moduleId, action, tenantQuery.data?.id ?? null);

  const licensed = (moduleId: ModuleId, requireWritable = false) =>
    canAccessModuleFeature(license, moduleId, requireWritable);

  const can = (permission: Permission) => userHasPermission(user, permission);

  const canAny = (...permissions: Permission[]) => userHasAnyPermission(user, permissions);

  return {
    me,
    license,
    tenant: tenantQuery.data,
    isLoading: meQuery.isLoading || licenseQuery.isLoading,
    isWritable: isLicenseWritable(license),
    isGrace: license?.status === "grace",
    isExpired: license?.status === "expired",
    isSuspended: license?.status === "suspended",
    graceDaysRemaining: license?.grace_days_remaining ?? 0,
    daysRemaining: license?.days_remaining,
    canModule,
    licensed,
    can,
    canAny,
    modules: listLicensedModules().map((m) => ({
      id: m.id,
      enabled: m.licenseFeature ? !!license?.features[m.licenseFeature] : true,
    })),
    refetchLicense: licenseQuery.refetch,
  };
}

/** Backward-compatible license hook — maps legacy LicenseFeature to module registry. */
export function useLicenseStatus() {
  const licenseQuery = useQuery({
    queryKey: ["license-status"],
    queryFn: getLicenseStatus,
    staleTime: 60_000,
  });

  const status = licenseQuery.data;
  const isWritable = isLicenseWritable(status);
  const can = (feature: LicenseFeature, requireWritable = true) =>
    hasLicenseFeature(status, feature, { requireWritable });

  return {
    ...licenseQuery,
    status,
    isWritable,
    can,
    isGrace: status?.status === "grace",
    isExpired: status?.status === "expired",
    isSuspended: status?.status === "suspended",
    graceDaysRemaining: status?.grace_days_remaining ?? 0,
    daysRemaining: status?.days_remaining,
  };
}

export function useModuleNav(moduleId: ModuleId, action: ModuleAction = "read") {
  const { canModule, isLoading } = useAccessContext();
  return { visible: canModule(moduleId, action), isLoading, module: getModule(moduleId) };
}
