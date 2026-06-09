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

/** Authenticates internal cron/worker hook requests. */
export function verifyInternalHookRequest(request: Request): boolean {
  const secret = getInternalHookSecret();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return false;
    return safeEqual(auth.slice(7), secret);
  }

  const apiKey = request.headers.get("apikey");
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  return !!(expected && apiKey && safeEqual(apiKey, expected));
}

export function unauthorizedHookResponse(): Response {
  return new Response("Unauthorized", { status: 401 });
}
