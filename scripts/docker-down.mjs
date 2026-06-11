#!/usr/bin/env node
/**
 * Stop a named Flowmaster compose stack.
 *
 *   node scripts/docker-down.mjs              # default HTTP stack (flowmaster)
 *   node scripts/docker-down.mjs --tls
 *   node scripts/docker-down.mjs --staging
 *   node scripts/docker-down.mjs --license-server
 *   node scripts/docker-down.mjs --dev
 */

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildComposeDownCommand } from "./lib/docker-compose-cli.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

function stackFromArgs() {
  if (args.has("--license-server")) return { stack: "licenseServer" };
  if (args.has("--staging")) return { stack: "staging" };
  if (args.has("--tls")) return { stack: "tls" };
  if (args.has("--dev")) return { stack: "dev" };
  return { stack: "http" };
}

const stackOpts = stackFromArgs();
const downArgs = buildComposeDownCommand(stackOpts);

console.log(`Stopping stack (${stackOpts.stack})…`);
const res = spawnSync("docker", downArgs, {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(res.status ?? 1);
