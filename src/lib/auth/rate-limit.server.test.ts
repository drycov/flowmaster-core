import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertAuthRateLimit,
  assertAuthRateLimitForIdentity,
  resetAuthRateLimitsForTests,
  resolveClientIp,
} from "./rate-limit.server";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () =>
    new Request("http://localhost/auth", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    }),
}));

describe("rate-limit.server", () => {
  afterEach(() => {
    resetAuthRateLimitsForTests();
    vi.unstubAllEnvs();
  });

  it("parses first x-forwarded-for hop", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "198.51.100.2, 10.0.0.1" } });
    expect(resolveClientIp(req)).toBe("198.51.100.2");
  });

  it("blocks after IP limit is exceeded", () => {
    vi.stubEnv("AUTH_RATE_LIMIT_ENABLED", "true");

    for (let i = 0; i < 5; i++) {
      assertAuthRateLimit("vendor-admin-login");
    }

    expect(() => assertAuthRateLimit("vendor-admin-login")).toThrow(/Слишком много попыток/);
  });

  it("tracks identity keys separately from IP", () => {
    vi.stubEnv("AUTH_RATE_LIMIT_ENABLED", "true");

    for (let i = 0; i < 5; i++) {
      assertAuthRateLimitForIdentity("login", "user@example.com");
    }

    expect(() => assertAuthRateLimitForIdentity("login", "user@example.com")).toThrow(
      /Слишком много попыток/,
    );
    expect(() => assertAuthRateLimitForIdentity("login", "other@example.com")).not.toThrow();
  });

  it("is disabled when AUTH_RATE_LIMIT_ENABLED=false", () => {
    vi.stubEnv("AUTH_RATE_LIMIT_ENABLED", "false");

    for (let i = 0; i < 20; i++) {
      assertAuthRateLimit("login");
    }
  });
});
