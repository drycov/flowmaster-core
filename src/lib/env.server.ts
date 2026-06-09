let loaded = false;

/**
 * Mark server env as ready. Values come from process.env (Vite define / host / .env via server entry).
 * Safe if this module is referenced from client bundles — no Node.js built-ins.
 */
export function loadServerEnv() {
  loaded = true;
}

/**
 * Server-side Supabase env from process.env only.
 */
export function getSupabaseEnv() {
  if (!loaded) loadServerEnv();

  return {
    url: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    publishableKey:
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    jwtSecret:
      process.env.SUPABASE_JWT_SECRET ??
      process.env.APP_SESSION_SECRET ??
      process.env.VITE_SUPABASE_JWT_SECRET,
  };
}

/**
 * Stable installation ID for license binding.
 * Auto-derived from SUPABASE_PROJECT_REF (or persisted locally) — no manual .env needed.
 */
export function getInstallationId(): string {
  if (!loaded) loadServerEnv();
  return process.env.INSTALLATION_ID?.trim() ?? "";
}
