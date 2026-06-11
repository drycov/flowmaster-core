import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SUPABASE_ENV = "docker/supabase/.env";

/** Copy project root `.env` → `docker/supabase/.env` (Compose include loads env per compose file dir). */
export function syncSupabaseEnv(root) {
  const source = resolve(root, ".env");
  const target = resolve(root, SUPABASE_ENV);

  if (!existsSync(source)) {
    return { ok: false, reason: "missing-root-env", source, target };
  }

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  return { ok: true, source, target };
}

export function syncSupabaseEnvOrExit(root, hint = "npm run env:local") {
  const result = syncSupabaseEnv(root);
  if (!result.ok) {
    console.error(`Missing ${result.source} — run: ${hint}`);
    process.exit(1);
  }
  return result;
}
