import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withAuthRateLimit } from "@/lib/auth/auth-rate-limit.middleware";
import {
  clearVendorAdminSession,
  establishVendorAdminSession,
  hasValidVendorAdminSession,
} from "@/lib/license/server/vendor-local.server";
import {
  getAppVersion,
  isLicenseServerLocalAdminEnabled,
} from "@/lib/license/server/config.server";

export const getVendorAdminAvailability = createServerFn({ method: "GET" }).handler(async () => ({
  available: isLicenseServerLocalAdminEnabled(),
  app_version: getAppVersion(),
}));

export const getVendorAdminSession = createServerFn({ method: "GET" }).handler(async () => ({
  authenticated: hasValidVendorAdminSession(),
}));

export const loginVendorAdmin = createServerFn({ method: "POST" })
  .middleware([withAuthRateLimit("vendor-admin-login")])
  .inputValidator(z.object({ support_code: z.string().min(6).max(32) }))
  .handler(async ({ data }) => {
    establishVendorAdminSession(data.support_code);
    return { ok: true as const };
  });

export const logoutVendorAdmin = createServerFn({ method: "POST" }).handler(async () => {
  clearVendorAdminSession();
  return { ok: true as const };
});
