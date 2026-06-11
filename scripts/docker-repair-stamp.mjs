#!/usr/bin/env node
/**
 * Apply stamp_organization trigger repair directly on Postgres (bypasses migration ledger check).
 * Use when document INSERT fails with: record "new" has no field "source_document_id"
 *
 *   npm run docker:repair-stamp -- --tls
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "./lib/load-env.mjs";
import { buildComposeCommand } from "./lib/docker-compose-cli.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseStack(argv) {
  if (argv.includes("--staging")) return "staging";
  if (argv.includes("--tls")) return "tls";
  if (argv.includes("--dev")) return "dev";
  return "http";
}

const stack = parseStack(process.argv.slice(2));
loadEnvFiles([".env", ".env.staging", ".env.production"]);

const repairPath = resolve(root, "supabase/migrations/20260615140000_fix_stamp_organization_triggers.sql");
const sql =
  readFileSync(repairPath, "utf8") +
  `
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260615140000_fix_stamp_organization_triggers', '20260615140000_fix_stamp_organization_triggers')
ON CONFLICT (version) DO NOTHING;
`;

const cmd = buildComposeCommand({
  stack: stack === "tls" ? "tls" : stack === "http" ? "http" : stack,
  tls: stack === "tls",
  dev: stack === "dev",
  subcommand: ["exec", "-T", "db", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
});

console.log("[repair-stamp] applying trigger fix on db...");
const result = spawnSync("docker", cmd, {
  cwd: root,
  input: sql,
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  console.error("[repair-stamp] FAILED");
  process.exit(result.status ?? 1);
}

console.log("[repair-stamp] done — retry creating a document");
