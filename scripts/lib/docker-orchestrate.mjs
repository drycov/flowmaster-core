import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { syncSupabaseEnvOrExit } from "./sync-supabase-env.mjs";
import { STACKS, buildComposeCommand } from "./docker-compose-cli.mjs";

export function runProcess(cmd, cmdArgs, root) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function composeOpts(options) {
  const { stack, tls = false, dev = false, profiles = [] } = options;
  return { stack, tls, dev, profiles };
}

/**
 * Standard Flowmaster bring-up: sync env → up → migrate → restart app → wait Kong.
 */
export function orchestrateStack(root, options) {
  const {
    stack,
    tls = false,
    dev = false,
    profiles = [],
    label,
    envHint = "npm run env:local",
    restartServices = ["app", "nginx"],
  } = options;

  const stackId = stack ?? (dev ? "dev" : tls ? "tls" : "http");
  const stackLabel = label ?? STACKS[stackId]?.label ?? "Docker stack";

  if (!existsSync(resolve(root, ".env"))) {
    console.error(`Missing .env — run: ${envHint}`);
    process.exit(1);
  }

  syncSupabaseEnvOrExit(root);

  const opts = composeOpts({ stack: stackId, tls, dev, profiles });

  console.log(`Starting ${stackLabel}…`);
  runProcess("docker", buildComposeCommand({ ...opts, subcommand: ["up", "-d", "--build"] }), root);

  console.log("Applying database migrations…");
  runProcess("docker", buildComposeCommand({ ...opts, subcommand: ["run", "--rm", "db-migrate"] }), root);

  if (!dev && restartServices.length > 0) {
    console.log("Restarting app services after migrations…");
    runProcess(
      "docker",
      buildComposeCommand({ ...opts, subcommand: ["up", "-d", ...restartServices] }),
      root,
    );
  }

  runProcess("node", ["scripts/docker-wait.mjs"], root);
}

export function printStackUrls(root, { stack, tls = false, dev = false, studio = false, monitoring = false, office = false } = {}) {
  const env = process.env;
  const nginxPort = env.NGINX_HTTP_PORT ?? "80";
  const stagingPort = env.STAGING_NGINX_PORT ?? "8080";
  const domain = env.PROXY_DOMAIN?.trim();

  console.log("");
  if (dev) {
    console.log("Backend ready. Start app: npm run dev");
    console.log("  Supabase API: http://localhost:54321");
    console.log("  Postgres:     127.0.0.1:54322");
    if (studio) console.log("  Studio:       http://127.0.0.1:54323");
    return;
  }

  let appUrl;
  if (stack === "staging") {
    appUrl = env.APP_URL?.trim() || `http://localhost:${stagingPort}`;
  } else if (tls && domain) {
    appUrl = `https://${domain}`;
  } else {
    appUrl = env.APP_URL?.trim() || `http://localhost:${nginxPort}`;
  }

  console.log("Stack ready:");
  console.log(`  Nginx:        ${appUrl}  (app + Supabase API)`);
  console.log(`  Health:       curl ${appUrl}/api/health`);
  console.log("  App (direct): http://localhost:3000");
  console.log("  Supabase API: http://localhost:54321");
  if (studio) console.log("  Studio:       http://127.0.0.1:54323");
  if (monitoring) {
    console.log(`  Grafana:      http://127.0.0.1:${env.GRAFANA_PORT ?? "3001"}`);
    console.log(`  Prometheus:   http://127.0.0.1:${env.PROMETHEUS_PORT ?? "9090"}`);
  }
  if (office) {
    const officePort = env.ONLYOFFICE_HTTP_PORT ?? "8082";
    console.log(`  ONLYOFFICE:   ${appUrl}/onlyoffice  (direct :${officePort})`);
    console.log("  Admin:        Настройки → Интеграции → ONLYOFFICE → URL без / в конце");
    console.log(`                office_url: ${appUrl}/onlyoffice`);
    console.log("                app_url:    тот же публичный URL (для callback из браузера)");
  }
}
