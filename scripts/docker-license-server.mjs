#!/usr/bin/env node
/**
 * Start vendor license server stack (TLS + app + Supabase).
 *
 *   npm run compose:license-server
 */

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { composeBaseArgs } from "./lib/docker-compose-cli.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const licenseEnvPath = resolve(root, ".env.license-server");

if (!existsSync(envPath) && !existsSync(licenseEnvPath)) {
  console.error("Missing .env — run:");
  console.error("  npm run env:license-server -- --domain=license.example.kz --install");
  process.exit(1);
}

if (!existsSync(envPath) && existsSync(licenseEnvPath)) {
  console.error("Copy .env.license-server → .env first:");
  console.error("  npm run env:license-server -- --install");
  process.exit(1);
}

const args = [
  ...composeBaseArgs(["docker-compose.license-server.yml"]),
  "up",
  "-d",
  "--build",
];

console.log("Starting license server stack…");
const result = spawnSync("docker", args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
