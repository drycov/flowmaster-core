#!/usr/bin/env node
/**
 * Start Docker stack: backend → migrate → app (+ optional cron).
 *
 * Usage:
 *   node scripts/docker-up.mjs              # HTTP production (app + nginx)
 *   node scripts/docker-up.mjs --tls        # HTTPS production (+ ONLYOFFICE)
 *   node scripts/docker-up.mjs --tls --with-license-server  # + external .env.license-server stack
 *   node scripts/docker-up.mjs --full       # app + cron + studio + monitoring
 *   node scripts/docker-up.mjs --dev        # Supabase only (npm run dev on host)
 *   node scripts/docker-up.mjs --cron       # also start cron sidecar
 *   node scripts/docker-up.mjs --studio     # also start Supabase Studio
 *   node scripts/docker-up.mjs --monitoring
 *   node scripts/docker-up.mjs --office       # ONLYOFFICE (auto with --tls; disable: --no-office)
 *
 * License server (vendor, same domain):
 *   npm run env:production -- --domain=edms.example.kz --with-license-server --install
 *   npm run docker:up -- --tls
 *   curl https://edms.example.kz/api/v1/license/health
 */

import { loadEnvFiles } from "./lib/load-env.mjs";
import {
  orchestrateStack,
  orchestrateLicenseServerStack,
  printStackUrls,
} from "./lib/docker-orchestrate.mjs";
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
const noOffice = args.has("--no-office");
const office = !dev && !noOffice && (args.has("--office") || tls);
const withLicenseServer = args.has("--with-license-server") || args.has("--license-server");

loadEnvFiles([".env"]);

const profiles = [];
if (cron && !dev) profiles.push("cron");
if (studio) profiles.push("studio");
if (monitoring && !dev) profiles.push("monitoring");
if (office && !dev) profiles.push("office");

const envHint = tls
  ? "npm run env:production -- --domain=YOUR_DOMAIN --with-license-server --install"
  : "npm run env:local";

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
  envHint,
});

if (withLicenseServer && !dev) {
  orchestrateLicenseServerStack(root);
} else if (tls && !dev) {
  loadEnvFiles([".env"]);
  const enabled = ["1", "true", "yes"].includes(
    String(process.env.LICENSE_SERVER_ENABLED ?? "").trim().toLowerCase(),
  );
  if (!enabled) {
    console.log("");
    console.log("License server: не включён в .env");
    console.log("  Vendor (API на том же домене):");
    console.log(
      "    npm run env:production -- --domain=YOUR_DOMAIN --with-license-server --install",
    );
    console.log("    npm run docker:up -- --tls");
    console.log("  Отдельный VPS:");
    console.log("    npm run env:license-server -- --domain=license.example.kz --install");
    console.log("    npm run docker:up -- --tls --with-license-server");
  }
}

printStackUrls(root, { tls, dev, studio, monitoring, office });
