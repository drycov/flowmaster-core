import { createMiddleware } from "@tanstack/react-start";
import { APP_ACCESS_TOKEN_KEY } from "@/lib/auth/session-constants";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem(APP_ACCESS_TOKEN_KEY)
        : null;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);