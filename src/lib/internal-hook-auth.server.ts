import { timingSafeEqual } from "node:crypto";
import { loadServerEnv } from "@/lib/env.server";

export function getInternalHookSecret(): string | null {
  loadServerEnv();
  return process.env.INTERNAL_HOOK_SECRET?.trim() || process.env.CRON_SECRET?.trim() || null;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/** Authenticates internal cron/worker hook requests. CRON_SECRET is mandatory — no anon-key fallback. */
export function verifyInternalHookRequest(request: Request): boolean {
  const secret = getInternalHookSecret();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return safeEqual(auth.slice(7), secret);
}

export function unauthorizedHookResponse(): Response {
  return new Response("Unauthorized", { status: 401 });
}
