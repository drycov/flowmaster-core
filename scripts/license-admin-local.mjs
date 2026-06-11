#!/usr/bin/env node
/**
 * Local vendor license admin — loopback only, support code auth.
 *
 *   npm run license:admin
 *   npm run license:admin -- --port=3847
 *
 * On license server host (via SSH):
 *   npm run license:admin
 *
 * From laptop:
 *   ssh -L 3847:127.0.0.1:3847 user@license-server
 *   open http://127.0.0.1:3847/vendor/license
 *
 * Support code:
 *   npm run license:support-code
 */

import { spawn } from "node:child_process";
import { loadEnvFiles } from "./lib/load-env.mjs";

function flag(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

loadEnvFiles([".env", ".env.license-server", ".env.production"]);

const port = flag("--port", process.env.LICENSE_ADMIN_PORT ?? "3847");

const adminSecret = process.env.LICENSE_SERVER_ADMIN_SECRET?.trim();
const licenseUrl = (process.env.LICENSE_SERVER_URL ?? "").trim().replace(/\/$/, "");
const serverEnabled = process.env.LICENSE_SERVER_ENABLED === "true";

if (!adminSecret) {
  if (licenseUrl && !serverEnabled) {
    console.error("npm run license:admin — только для self-hosted license server на этом хосте.");
    console.error("");
    console.error(`У вас облачный license server: ${licenseUrl}`);
    console.error("  Web UI:  " + licenseUrl + "/admin");
    console.error("  CLI:     LICENSE_SERVER_URL + LICENSE_SERVER_ADMIN_SECRET → npm run license:server");
    console.error("");
    console.error("Self-hosted stack: npm run env:license-server -- --install && npm run docker:up -- --license-server-stack");
  } else {
    console.error("LICENSE_SERVER_ADMIN_SECRET required (.env.license-server)");
    console.error("Hint: npm run env:license-server -- --install");
  }
  process.exit(1);
}

const env = {
  ...process.env,
  LICENSE_SERVER_ENABLED: "true",
  LICENSE_SERVER_LOCAL_ADMIN: "true",
  LICENSE_MODE: "offline",
  NODE_ENV: process.env.NODE_ENV ?? "development",
};

console.log("");
console.log("Vendor license admin (localhost only)");
console.log(`  URL:    http://127.0.0.1:${port}/vendor/license`);
console.log(`  Code:   npm run license:support-code`);
console.log(`  Tunnel: ssh -L ${port}:127.0.0.1:${port} user@license-server`);
console.log("");

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { stdio: "inherit", env, shell: process.platform === "win32" },
);

child.on("exit", (code) => process.exit(code ?? 0));
