import { getRequest } from "@tanstack/react-start/server";

import { logger } from "@/lib/logger.server";

export type AuthRateLimitScope =
  | "login"
  | "register"
  | "ldap"
  | "eds-challenge"
  | "eds-complete"
  | "telegram-start"
  | "telegram-complete"
  | "password-reset-request"
  | "password-reset-confirm"
  | "refresh"
  | "vendor-admin-login";

type BucketPreset = { max: number; windowMs: number };

const IP_PRESETS: Record<AuthRateLimitScope, BucketPreset> = {
  login: { max: 10, windowMs: 15 * 60_000 },
  register: { max: 5, windowMs: 60 * 60_000 },
  ldap: { max: 10, windowMs: 15 * 60_000 },
  "eds-challenge": { max: 20, windowMs: 15 * 60_000 },
  "eds-complete": { max: 10, windowMs: 15 * 60_000 },
  "telegram-start": { max: 15, windowMs: 15 * 60_000 },
  "telegram-complete": { max: 30, windowMs: 15 * 60_000 },
  "password-reset-request": { max: 5, windowMs: 60 * 60_000 },
  "password-reset-confirm": { max: 10, windowMs: 60 * 60_000 },
  refresh: { max: 60, windowMs: 15 * 60_000 },
  "vendor-admin-login": { max: 5, windowMs: 15 * 60_000 },
};

const IDENTITY_PRESETS: Partial<Record<AuthRateLimitScope, BucketPreset>> = {
  login: { max: 5, windowMs: 15 * 60_000 },
  register: { max: 3, windowMs: 60 * 60_000 },
  ldap: { max: 5, windowMs: 15 * 60_000 },
  "password-reset-request": { max: 3, windowMs: 60 * 60_000 },
  "password-reset-confirm": { max: 5, windowMs: 60 * 60_000 },
};

type BucketEntry = { count: number; resetAt: number };

const buckets = new Map<string, BucketEntry>();
let consumeCount = 0;

function isRateLimitEnabled(): boolean {
  return process.env.AUTH_RATE_LIMIT_ENABLED !== "false";
}

function presetFor(scope: AuthRateLimitScope, kind: "ip" | "identity"): BucketPreset {
  if (kind === "identity") {
    return IDENTITY_PRESETS[scope] ?? { max: 5, windowMs: 15 * 60_000 };
  }
  return IP_PRESETS[scope];
}

function maybeSweep(now: number): void {
  consumeCount++;
  if (consumeCount % 256 !== 0 && buckets.size < 5_000) return;

  for (const [key, entry] of buckets) {
    if (now >= entry.resetAt) buckets.delete(key);
  }
}

export function resolveClientIp(request?: Request | null): string {
  if (!request?.headers) return "unknown";

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

function consume(key: string, max: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  maybeSweep(now);

  const entry = buckets.get(key);
  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (entry.count >= max) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }

  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

function normalizeIdentityKey(value: string): string {
  return value.trim().toLowerCase();
}

function deny(scope: AuthRateLimitScope, kind: "ip" | "identity", retryAfterSec: number): never {
  logger.warn("auth rate limit exceeded", { scope, kind, retry_after_sec: retryAfterSec });
  throw new Error(`Слишком много попыток. Повторите через ${retryAfterSec} с.`);
}

/** IP-based limit for the given auth scope. */
export function assertAuthRateLimit(scope: AuthRateLimitScope): void {
  if (!isRateLimitEnabled()) return;

  const request = getRequest();
  const ip = resolveClientIp(request);
  const preset = presetFor(scope, "ip");
  const result = consume(`${scope}:ip:${ip}`, preset.max, preset.windowMs);
  if (!result.allowed) deny(scope, "ip", result.retryAfterSec);
}

/** Additional per-account limit (email, LDAP username, etc.). */
export function assertAuthRateLimitForIdentity(scope: AuthRateLimitScope, identity: string): void {
  if (!isRateLimitEnabled()) return;

  const normalized = normalizeIdentityKey(identity);
  if (!normalized) return;

  const preset = presetFor(scope, "identity");
  const result = consume(`${scope}:id:${normalized}`, preset.max, preset.windowMs);
  if (!result.allowed) deny(scope, "identity", result.retryAfterSec);
}

/** Test helper — reset in-memory counters. */
export function resetAuthRateLimitsForTests(): void {
  buckets.clear();
  consumeCount = 0;
}
