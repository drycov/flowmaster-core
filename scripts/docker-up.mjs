#!/usr/bin/env node
/**
 * Start Docker stack: backend → migrate → app (+ optional cron).
 *
 * Usage:
 *   node scripts/docker-up.mjs              # production stack (app + nginx)
 *   node scripts/docker-up.mjs --full       # app + cron + studio + monitoring
 *   node scripts/docker-up.mjs --dev        # Supabase only (npm run dev on host)
 *   node scripts/docker-up.mjs --cron       # also start cron sidecar
 *   node scripts/docker-up.mjs --studio     # also start Supabase Studio
 *   node scripts/docker-up.mjs --monitoring # also start Prometheus/Grafana stack
 *   node scripts/docker-up.mjs --tls        # use docker-compose.tls.yml
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { syncSupabaseEnvOrExit } from "./lib/sync-supabase-env.mjs";
import { FULL_PROFILES, buildComposeCommand } from "./lib/docker-compose-cli.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dev = args.has("--dev");
const tls = args.has("--tls");
const full = args.has("--full");
const cron = full || args.has("--cron");
const studio = full || args.has("--studio");
const monitoring = full || args.has("--monitoring");

if (!existsSync(resolve(root, ".env"))) {
  console.error("Missing .env — run: npm run env:local");
  process.exit(1);
}

syncSupabaseEnvOrExit(root);

function run(cmd, cmdArgs) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const profiles = [];
if (cron && !dev) profiles.push("cron");
if (studio) profiles.push("studio");
if (monitoring && !dev) profiles.push("monitoring");

console.log(
  dev
    ? "Starting Supabase backend (dev)..."
    : full
      ? "Starting full Docker stack..."
      : "Starting Docker stack (app + nginx)...",
);

run("docker", buildComposeCommand({ tls, dev, profiles, subcommand: ["up", "-d", "--build"] }));

console.log("Applying database migrations...");
run("docker", buildComposeCommand({ tls, dev, profiles, subcommand: ["run", "--rm", "db-migrate"] }));

if (!dev) {
  console.log("Restarting app after migrations...");
  run("docker", buildComposeCommand({ tls, dev, profiles, subcommand: ["up", "-d", "app", "nginx"] }));
}

run("node", ["scripts/docker-wait.mjs"], { cwd: root });

console.log("");
if (dev) {
  console.log("Backend ready. Start app: npm run dev");
  console.log("  Supabase API: http://localhost:54321");
  console.log("  Postgres:     127.0.0.1:54322");
  if (studio) console.log("  Studio:       http://127.0.0.1:54323");
} else {
  const nginxPort = process.env.NGINX_HTTP_PORT ?? "80";
  const domain = process.env.PROXY_DOMAIN?.trim();
  const appUrl = tls && domain ? `https://${domain}` : `http://localhost:${nginxPort}`;
  console.log("Stack ready:");
  console.log(`  Nginx:        ${appUrl}  (app + Supabase API)`);
  console.log("  App (direct): http://localhost:3000");
  console.log("  Supabase API: http://localhost:54321");
  console.log(`  Health:       curl ${tls ? appUrl : `http://localhost:${nginxPort}`}/api/health`);
  if (studio) console.log("  Studio:       http://127.0.0.1:54323");
  if (monitoring) {
    console.log(`  Grafana:      http://127.0.0.1:${process.env.GRAFANA_PORT ?? "3001"}`);
    console.log(`  Prometheus:   http://127.0.0.1:${process.env.PROMETHEUS_PORT ?? "9090"}`);
  }
}
