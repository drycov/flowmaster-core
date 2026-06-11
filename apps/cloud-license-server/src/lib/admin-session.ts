export {
  getVendorAdminIdentity as getVendorAdminFromRequest,
  isVendorAdminFullyAuthenticated as hasAdminSession,
  isVendorAdminUiConfigured as isAdminUiConfigured,
  requireVendorAdminSession as requireAdminSession,
} from "./vendor-admin-auth.js";
