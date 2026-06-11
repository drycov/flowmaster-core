export {
  getVendorAdminIdentity as getVendorAdminFromRequest,
  hasVendorAdminSession as hasAdminSession,
  requireVendorAdminSession as requireAdminSession,
} from "./vendor-admin-auth.js";

export { isVendorAdminUiConfigured } from "./vendor-staff.server.js";
