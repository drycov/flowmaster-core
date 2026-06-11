#!/usr/bin/env node
/**
 * Run db-migrate against a named compose stack.
 *
 *   npm run docker:migrate
 *   npm run docker:migrate -- --tls
 *   npm run docker:migrate -- --staging
 *   npm run docker:migrate -- --license-server
 */

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "./lib/load-env.mjs";
import { buildComposeCommand } from "./lib/docker-compose-cli.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseStack(argv) {
  if (argv.includes("--license-server")) return "licenseServer";
  if (argv.includes("--staging")) return "staging";
  if (argv.includes("--tls")) return "tls";
  if (argv.includes("--dev")) return "dev";
  return "http";
}

const stack = parseStack(process.argv.slice(2));
loadEnvFiles([".env", ".env.staging", ".env.production", ".env.license-server"]);

const cmd = buildComposeCommand({
  stack: stack === "tls" ? "tls" : stack === "http" ? "http" : stack,
  tls: stack === "tls",
  dev: stack === "dev",
  subcommand: ["run", "--rm", "db-migrate"],
});

const result = spawnSync("docker", cmd, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
