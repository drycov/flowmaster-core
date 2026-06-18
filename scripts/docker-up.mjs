#!/usr/bin/env node
/**
 * Start Docker stack: backend → migrate → app (+ optional cron).
 *
 * Usage:
 *   node scripts/docker-up.mjs              # HTTP production (app + nginx)
 *   node scripts/docker-up.mjs --tls        # HTTPS production (+ ONLYOFFICE)
 *   node scripts/docker-up.mjs --tls --license-server-stack  # + self-hosted .env.license-server (отдельный VPS)
 *   node scripts/docker-up.mjs --full       # app + cron + studio + monitoring
 *   node scripts/docker-up.mjs --dev        # Supabase only (npm run dev on host)
 *   node scripts/docker-up.mjs --cron       # also start cron sidecar
 *   node scripts/docker-up.mjs --studio     # also start Supabase Studio
 *   node scripts/docker-up.mjs --monitoring
 *   node scripts/docker-up.mjs --office       # ONLYOFFICE (auto with --tls; disable: --no-office)
 *
 * Облако (Vercel) — только env, отдельный compose не нужен:
 *   npm run env:production -- --domain=edms.satory.kz \
 *     --with-license-server --installation-id=<uuid> --install
 *   npm run docker:up -- --tls --cron
 *
 * Vendor (license API на том же домене):
 * Vendor (license API на том же домене) — не используется; лицензии только через z-license (Vercel).
 *   npm run docker:up -- --tls
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
/** Поднять отдельный Docker-стек из .env.license-server (self-hosted VPS, не Vercel). */
const startLicenseServerStack =
  args.has("--license-server-stack") || args.has("--license-server");

loadEnvFiles([".env"]);

const profiles = [];
if (cron && !dev) profiles.push("cron");
if (studio) profiles.push("studio");
if (monitoring && !dev) profiles.push("monitoring");
if (office && !dev) profiles.push("office");

const envHint = tls
  ? "npm run env:production -- --domain=YOUR_DOMAIN --with-license-server --installation-id=UUID --install"
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

if (startLicenseServerStack && !dev) {
  orchestrateLicenseServerStack(root);
} else if (tls && !dev) {
  loadEnvFiles([".env"]);
  const enabled = ["1", "true", "yes"].includes(
    String(process.env.LICENSE_SERVER_ENABLED ?? "").trim().toLowerCase(),
  );
  const cloudLicense = Boolean(process.env.LICENSE_SERVER_URL?.trim());
  if (cloudLicense) {
    console.log("");
    console.log("License (облако z-license): EDMS → " + process.env.LICENSE_SERVER_URL.trim());
    console.log("  Cron sync: npm run docker:up -- --tls --cron");
  } else if (!enabled) {
    console.log("");
    console.log("License: не настроен в .env");
    console.log("  Облако (z-license):");
    console.log(
      "    npm run env:production -- --domain=YOUR_DOMAIN --with-license-server --installation-id=UUID --install",
    );
    console.log("  Replica (закрытый контур, отдельный VPS license):");
    console.log("    npm run env:license-server -- --domain=license.example.kz --install");
    console.log("    npm run docker:up -- --tls --license-server-stack");
  }
}

printStackUrls(root, { tls, dev, studio, monitoring, office });
