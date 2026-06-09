export type {
  ModuleAccessContext,
  ModuleAccessResult,
  ModuleAction,
  ModuleDefinition,
  ModuleId,
  ModuleRouteGuard,
  ModuleTier,
  UserAccessSnapshot,
} from "./types";
export { MODULE_IDS } from "./types";

export {
  ALL_PERMISSIONS,
  ADMIN_IMPLICIT_PERMISSIONS,
  isPermission,
  type Permission,
} from "./permissions";

export {
  getModule,
  findModuleByPath,
  listLicensedModules,
  listAdminModules,
  MODULE_REGISTRY,
} from "./modules/registry";

export { evaluateModuleAccess, canAccessModule, canAccessModuleFeature } from "./evaluate";

export {
  requirePermission,
  requireAnyPermission,
  fetchUserPermissions,
  requireAdmin,
  userHasPermission,
  userHasAnyPermission,
  userCanManageSystemSettings,
  userCanManageIntegrations,
  requireSystemSettingsAccess,
  requireIntegrationsAccess,
} from "./rbac.server";

export {
  requireModuleAccess,
  enforceModuleLicense,
  moduleLicenseFeature,
  enforceLicense,
  requireAvailableSeat,
  requireLicenseFeature,
  requireLicenseFeatureAccess,
  requireWritableLicense,
  LicenseError,
  isLicenseError,
  type ModuleEnforcementOpts,
} from "./enforcement.server";

export {
  requireModule,
  requireModuleForPath,
  requireLicenseModule,
  requireAnyPermission as requireRoutePermission,
  requireAdminOrPermission,
} from "./route-guards";

export {
  WORK_NAV,
  HR_NAV,
  CORRESPONDENCE_NAV,
  REGISTRY_NAV,
  SERVICE_NAV,
  REFERENCE_NAV,
  ADMIN_NAV_SECTIONS,
  filterNavItems,
  filterNavGroup,
  filterAdminSections,
  isNavItemVisible,
  type NavItemDef,
  type NavGroupDef,
  type AdminNavSectionDef,
} from "./navigation";

export { useAccessContext, useLicenseStatus, useModuleNav } from "./hooks";

export { resolveTenantContext, tenantScopeKey, type TenantContext } from "./tenant";
export {
  resolveTenantFromOrganization,
  resolveTenantFromOrganizationId,
  resolveTenantFromSlug,
} from "./tenant.server";
