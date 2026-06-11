#!/usr/bin/env node
/**
 * Full stack: app + Supabase + nginx + cron + Studio + monitoring.
 *
 * Usage:
 *   npm run docker:full
 *   npm run compose:tls:full
 *   node scripts/docker-full.mjs --tls
 *   node scripts/docker-full.mjs --dev   # Supabase + studio only (app via npm run dev)
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { syncSupabaseEnvOrExit } from "./lib/sync-supabase-env.mjs";
import { FULL_PROFILES, buildComposeCommand } from "./lib/docker-compose-cli.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const tls = args.has("--tls");
const dev = args.has("--dev");

if (!existsSync(resolve(root, ".env"))) {
  console.error("Missing .env — run: npm run env:local (or env:production -- --install)");
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

const profiles = dev ? ["studio"] : FULL_PROFILES;

console.log(
  dev
    ? "Starting Supabase + Studio (full dev backend)..."
    : tls
      ? "Starting FULL production stack (HTTPS + cron + studio + monitoring)..."
      : "Starting FULL stack (app + cron + studio + monitoring)...",
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
console.log("Full stack ready:");
if (dev) {
  console.log("  Supabase API:  http://localhost:54321");
  console.log("  Studio:        http://127.0.0.1:54323  (profile studio)");
  console.log("  Postgres:       127.0.0.1:54322");
  console.log("  App:            npm run dev");
} else {
  const nginxPort = process.env.NGINX_HTTP_PORT ?? "80";
  const httpsPort = process.env.NGINX_HTTPS_PORT ?? "443";
  const domain = process.env.PROXY_DOMAIN?.trim();
  const appUrl = tls && domain ? `https://${domain}` : `http://localhost:${nginxPort}`;
  console.log(`  App (nginx):     ${appUrl}`);
  console.log("  App (direct):    http://localhost:3000");
  console.log("  Supabase API:    http://localhost:54321");
  console.log("  Studio:          http://127.0.0.1:54323");
  console.log(`  Health:          curl ${appUrl}/api/health`);
  console.log(`  Grafana:         http://127.0.0.1:${process.env.GRAFANA_PORT ?? "3001"}`);
  console.log(`  Prometheus:      http://127.0.0.1:${process.env.PROMETHEUS_PORT ?? "9090"}`);
  console.log(`  cAdvisor:        http://127.0.0.1:${process.env.CADVISOR_PORT ?? "8081"}`);
  if (tls && domain) {
    console.log(`  HTTPS:           https://${domain}:${httpsPort}`);
  }
}
