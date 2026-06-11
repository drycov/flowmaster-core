import { timingSafeEqual } from "node:crypto";

export function verifyAdminAuth(authorization: string | undefined): boolean {
  const secret = process.env.LICENSE_SERVER_ADMIN_SECRET?.trim();
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice(7);
  if (token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

export function requireAdmin(c: { req: { header: (name: string) => string | undefined } }): boolean {
  return verifyAdminAuth(c.req.header("authorization"));
}
