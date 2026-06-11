#!/usr/bin/env node
/**
 * Start Docker stack: backend → migrate → app (+ optional cron).
 *
 * Usage:
 *   node scripts/docker-up.mjs              # HTTP production (app + nginx)
 *   node scripts/docker-up.mjs --tls      # HTTPS production
 *   node scripts/docker-up.mjs --full     # app + cron + studio + monitoring
 *   node scripts/docker-up.mjs --dev      # Supabase only (npm run dev on host)
 *   node scripts/docker-up.mjs --cron     # also start cron sidecar
 *   node scripts/docker-up.mjs --studio   # also start Supabase Studio
 *   node scripts/docker-up.mjs --monitoring
 */

import { loadEnvFiles } from "./lib/load-env.mjs";
import { orchestrateStack, printStackUrls } from "./lib/docker-orchestrate.mjs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dev = args.has("--dev");
const tls = args.has("--tls");
const full = args.has("--full");
const cron = full || args.has("--cron");
const studio = full || args.has("--studio");
const monitoring = full || args.has("--monitoring");

loadEnvFiles([".env"]);

const profiles = [];
if (cron && !dev) profiles.push("cron");
if (studio) profiles.push("studio");
if (monitoring && !dev) profiles.push("monitoring");

orchestrateStack(root, {
  stack: dev ? "dev" : tls ? "tls" : "http",
  tls,
  dev,
  profiles,
  label: dev
    ? "Supabase backend (dev)"
    : full
      ? "full Docker stack"
      : tls
        ? "HTTPS production stack"
        : "Docker stack (app + nginx)",
  envHint: "npm run env:local",
});

printStackUrls(root, { tls, dev, studio, monitoring });
