import { createMiddleware } from "@tanstack/react-start";

import { assertAuthRateLimit, type AuthRateLimitScope } from "@/lib/auth/rate-limit.server";

export function withAuthRateLimit(scope: AuthRateLimitScope) {
  return createMiddleware({ type: "function" }).server(async ({ next }) => {
    assertAuthRateLimit(scope);
    return next();
  });
}
