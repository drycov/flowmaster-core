import type { Context } from "hono";
import { getPortalUserFromRequest, type PortalUser } from "./portal-auth.js";
import {
  getVendorAdminAllowlist,
  isVendorAdminUiConfigured,
  isVendorStepUpVerifyRequired,
} from "./vendor-admin-config.js";
import { hasValidVerifyCookie } from "./vendor-admin-verify.js";

export { getVendorAdminAllowlist, isVendorAdminUiConfigured } from "./vendor-admin-config.js";

export async function getVendorAdminIdentity(
  authorization: string | undefined,
): Promise<PortalUser | null> {
  const user = await getPortalUserFromRequest(authorization);
  if (!user) return null;
  const allowlist = getVendorAdminAllowlist();
  if (!allowlist.has(user.email.toLowerCase())) return null;
  return user;
}

export async function isVendorAdminFullyAuthenticated(c: Context): Promise<boolean> {
  const user = await getVendorAdminIdentity(c.req.header("Authorization"));
  if (!user) return false;
  if (!isVendorStepUpVerifyRequired()) return true;
  return hasValidVerifyCookie(c, user.id);
}

export async function requireVendorAdminSession(c: Context): Promise<Response | null> {
  if (!isVendorAdminUiConfigured()) {
    return c.json(
      { error: "Admin UI не настроен (LICENSE_SERVER_VENDOR_ADMIN_EMAILS)" },
      503,
    );
  }
  const user = await getVendorAdminIdentity(c.req.header("Authorization"));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (isVendorStepUpVerifyRequired() && !hasValidVerifyCookie(c, user.id)) {
    return c.json({ error: "Требуется подтверждение (Telegram или webhook)" }, 403);
  }
  return null;
}

/** @deprecated use isVendorAdminFullyAuthenticated */
export async function hasVendorAdminSession(c: Context): Promise<boolean> {
  return isVendorAdminFullyAuthenticated(c);
}
