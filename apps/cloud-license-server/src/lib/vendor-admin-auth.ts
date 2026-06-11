import type { Context } from "hono";
import { getPortalUserFromRequest } from "./portal-auth.js";
import { isVendorStepUpVerifyRequiredAsync } from "./vendor-admin-config.js";
import {
  isVendorAdminUiConfigured,
  resolveVendorAdminIdentity,
  type VendorAdminIdentity,
} from "./vendor-staff.server.js";
import { hasValidVerifyCookie } from "./vendor-admin-verify.js";
import { getSupabase } from "./supabase.js";

export {
  canManageVendorStaff,
  type VendorAdminIdentity,
  type VendorStaffPublic,
} from "./vendor-staff.server.js";

export async function getVendorAdminIdentity(
  authorization: string | undefined,
): Promise<VendorAdminIdentity | null> {
  return resolveVendorAdminIdentity(
    getSupabase(),
    authorization,
    getPortalUserFromRequest,
  );
}

export async function isVendorAdminFullyAuthenticated(c: Context): Promise<boolean> {
  const identity = await getVendorAdminIdentity(c.req.header("Authorization"));
  if (!identity) return false;
  if (!(await isVendorStepUpVerifyRequiredAsync(getSupabase()))) return true;
  return hasValidVerifyCookie(c, identity.id);
}

export async function requireVendorAdminSession(c: Context): Promise<Response | null> {
  const supabase = getSupabase();
  if (!(await isVendorAdminUiConfigured(supabase))) {
    return c.json(
      {
        error:
          "Admin UI не настроен (vendor_staff пуст — задайте LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS и VENDOR_TELEGRAM_BOT_TOKEN)",
      },
      503,
    );
  }
  const identity = await getVendorAdminIdentity(c.req.header("Authorization"));
  if (!identity) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if ((await isVendorStepUpVerifyRequiredAsync(supabase)) && !hasValidVerifyCookie(c, identity.id)) {
    return c.json({ error: "Требуется подтверждение (Telegram или webhook)" }, 403);
  }
  return null;
}

export async function requireVendorStaffManager(c: Context): Promise<Response | null> {
  const denied = await requireVendorAdminSession(c);
  if (denied) return denied;
  const identity = await getVendorAdminIdentity(c.req.header("Authorization"));
  if (!identity || (identity.staff.role !== "owner" && identity.staff.role !== "admin")) {
    return c.json({ error: "Forbidden" }, 403);
  }
  return null;
}

/** @deprecated use isVendorAdminFullyAuthenticated */
export async function hasVendorAdminSession(c: Context): Promise<boolean> {
  return isVendorAdminFullyAuthenticated(c);
}
