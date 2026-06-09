import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvValue(raw: string): string {
  const val = raw.trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    return val.slice(1, -1);
  }
  return val;
}

/** Read .env from disk into process.env (server entry only — never import from client code). */
export function loadEnvFileIntoProcessEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    if (process.env[key] === undefined) {
      process.env[key] = parseEnvValue(line.slice(eq + 1));
    }
  }
}
