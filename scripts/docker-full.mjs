#!/usr/bin/env node
/**
 * Full stack: app + Supabase + nginx + cron + Studio + monitoring.
 *
 * Usage:
 *   npm run compose:full
 *   npm run compose:tls:full
 *   node scripts/docker-full.mjs --tls
 *   node scripts/docker-full.mjs --dev
 */

import { loadEnvFiles } from "./lib/load-env.mjs";
import { FULL_PROFILES } from "./lib/docker-compose-cli.mjs";
import { orchestrateStack, printStackUrls } from "./lib/docker-orchestrate.mjs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const tls = args.has("--tls");
const dev = args.has("--dev");

loadEnvFiles([".env"]);

const profiles = dev ? ["studio"] : FULL_PROFILES;

orchestrateStack(root, {
  stack: dev ? "dev" : tls ? "tls" : "http",
  tls,
  dev,
  profiles,
  label: dev
    ? "Supabase + Studio (dev backend)"
    : tls
      ? "FULL production stack (HTTPS + cron + studio + monitoring)"
      : "FULL stack (cron + studio + monitoring)",
  envHint: "npm run env:local (or env:production -- --install)",
});

printStackUrls(root, { stack: tls ? "tls" : "http", tls, dev, studio: true, monitoring: !dev });
