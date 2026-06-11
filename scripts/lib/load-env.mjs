import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnvValues } from "./env-file.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Load KEY=value pairs from repo .env files into process.env (no override). */
export function loadEnvFiles(paths = [".env", ".env.license-server", ".env.production"]) {
  for (const rel of paths) {
    const abs = resolve(root, rel);
    if (!existsSync(abs)) continue;
    for (const [key, value] of parseEnvValues(readFileSync(abs, "utf8"))) {
      if (value.length > 0 && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

export const repoRoot = root;
