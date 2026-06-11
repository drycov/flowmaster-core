#!/usr/bin/env node
/**
 * Start Docker stack: backend → migrate → app (+ optional cron).
 *
 * Usage:
 *   node scripts/docker-up.mjs              # full production stack
 *   node scripts/docker-up.mjs --dev        # Supabase only (npm run dev on host)
 *   node scripts/docker-up.mjs --cron       # also start cron sidecar
 *   node scripts/docker-up.mjs --studio     # also start Supabase Studio
 *   node scripts/docker-up.mjs --monitoring # also start Prometheus/Grafana stack
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { syncSupabaseEnvOrExit } from "./lib/sync-supabase-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dev = args.has("--dev");
const cron = args.has("--cron");
const studio = args.has("--studio");
const monitoring = args.has("--monitoring");

if (!existsSync(resolve(root, ".env"))) {
  console.error("Missing .env — run: npm run env:local");
  process.exit(1);
}

syncSupabaseEnvOrExit(root);

function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const composeFile = dev ? "docker-compose.dev.yml" : "docker-compose.yml";
const base = ["compose", "-f", composeFile];

console.log(dev ? "Starting Supabase backend (dev)..." : "Starting full Docker stack...");

run("docker", [...base, "up", "-d", "--build"]);

console.log("Applying database migrations...");
run("docker", [...base, "run", "--rm", "db-migrate"]);

if (!dev) {
  console.log("Restarting app after migrations...");
  run("docker", [...base, "up", "-d", "app"]);
}

if (cron && !dev) {
  run("docker", ["compose", "--profile", "cron", "up", "-d"]);
}

if (studio) {
  run("docker", [...base, "--profile", "studio", "up", "-d"]);
}

if (monitoring && !dev) {
  run("docker", [
    "compose",
    "-f",
    composeFile,
    "-f",
    "docker-compose.monitoring.yml",
    "--profile",
    "monitoring",
    "up",
    "-d",
  ]);
}

run("node", ["scripts/docker-wait.mjs"], { cwd: root });

console.log("");
if (dev) {
  console.log("Backend ready. Start app: npm run dev");
  console.log("  Supabase API: http://localhost:54321");
  console.log("  Postgres:     127.0.0.1:54322");
} else {
  const nginxPort = process.env.NGINX_HTTP_PORT ?? "80";
  console.log("Stack ready:");
  console.log(`  Nginx:        http://localhost:${nginxPort}  (app + Supabase API)`);
  console.log("  App (direct): http://localhost:3000");
  console.log("  Supabase API: http://localhost:54321");
  console.log(`  Health:       curl http://localhost:${nginxPort}/api/health`);
  if (monitoring) {
    const grafanaPort = process.env.GRAFANA_PORT ?? "3001";
    console.log(`  Grafana:      http://127.0.0.1:${grafanaPort}  (admin / see GRAFANA_ADMIN_PASSWORD)`);
    console.log(`  Prometheus:   http://127.0.0.1:${process.env.PROMETHEUS_PORT ?? "9090"}`);
  }
}
