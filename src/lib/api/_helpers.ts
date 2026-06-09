import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enforceLicense,
  requireAvailableSeat,
  requireLicenseFeature,
  requireLicenseFeatureAccess,
  enforceModuleLicense,
  requireModuleAccess,
  requireWritableLicense,
} from "@/lib/access/enforcement.server";
import {
  fetchUserPermissions,
  requireAdmin,
  requireAnyPermission,
  requireIntegrationsAccess,
  requirePermission,
  requireSystemSettingsAccess,
} from "@/lib/access/rbac.server";

export {
  enforceLicense,
  requireWritableLicense,
  requireLicenseFeature,
  requireLicenseFeatureAccess,
  requireAvailableSeat,
  requireModuleAccess,
  enforceModuleLicense,
};

export { requirePermission, requireAnyPermission, requireAdmin, fetchUserPermissions };
export { requireSystemSettingsAccess, requireIntegrationsAccess };
