import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SUPABASE_ENV = "docker/supabase/.env";

/** Copy project root `.env` → `docker/supabase/.env` (Compose include loads env per compose file dir). */
export function syncSupabaseEnv(root) {
  const source = resolve(root, ".env");
  const target = resolve(root, SUPABASE_ENV);

  if (!existsSync(source)) {
    return { ok: false, reason: "missing-root-env", source, target };
  }

  copyFileSync(source, target, { force: true });
  return { ok: true, source, target };
}

export function syncSupabaseEnvOrExit(root) {
  const result = syncSupabaseEnv(root);
  if (!result.ok) {
    console.error(`Missing ${result.source} — run: npm run env:local`);
    process.exit(1);
  }
  return result;
}
