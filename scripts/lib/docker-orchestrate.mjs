import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFiles } from "./load-env.mjs";
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

/**
 * Start vendor license server on a separate compose project (.env.license-server).
 * Swaps root .env only for compose up, then restores EDMS .env.
 */
export function orchestrateLicenseServerStack(root) {
  const mainEnv = resolve(root, ".env");
  const licenseEnv = resolve(root, ".env.license-server");
  const backupEnv = resolve(root, ".env.edms-backup");

  if (!existsSync(licenseEnv)) {
    console.error("Missing .env.license-server — run:");
    console.error("  npm run env:license-server -- --domain=license.example.kz --install");
    process.exit(1);
  }

  console.warn(
    "External license server uses ports 80/443 — run only on a separate VPS (not alongside EDMS on the same host).",
  );

  copyFileSync(mainEnv, backupEnv);
  try {
    copyFileSync(licenseEnv, mainEnv);
    syncSupabaseEnvOrExit(root, "npm run env:license-server -- --install");

    console.log("Starting License server (HTTPS)…");
    runProcess(
      "docker",
      buildComposeCommand({
        stack: "licenseServer",
        subcommand: ["up", "-d", "--build"],
      }),
      root,
    );

    console.log("Applying license server database migrations…");
    runProcess(
      "docker",
      buildComposeCommand({
        stack: "licenseServer",
        subcommand: ["run", "--rm", "db-migrate"],
      }),
      root,
    );

    runProcess(
      "docker",
      buildComposeCommand({
        stack: "licenseServer",
        subcommand: ["up", "-d", "app", "nginx"],
      }),
      root,
    );
  } finally {
    copyFileSync(backupEnv, mainEnv);
    syncSupabaseEnvOrExit(root, "npm run env:local");
  }
}

function isTruthyEnv(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function printLicenseServerHints(root, { tls = false } = {}) {
  loadEnvFiles([".env", ".env.license-server"]);
  const domain = process.env.PROXY_DOMAIN?.trim();
  const appUrl =
    tls && domain
      ? `https://${domain}`
      : (process.env.APP_URL?.trim() || "http://localhost");

  if (isTruthyEnv(process.env.LICENSE_SERVER_ENABLED)) {
    console.log(`  License API:  ${appUrl}/api/v1/license/health`);
    console.log("  Vendor admin: npm run license:support-code  (на хосте, SSH tunnel → license:admin)");
    return;
  }

  const licenseDomain = process.env.LICENSE_SERVER_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (licenseDomain) {
    console.log(`  License URL (client): ${process.env.LICENSE_SERVER_URL}`);
    console.log("  License server stack: npm run compose:license-server  (отдельный VPS)");
  }
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

  printLicenseServerHints(root, { tls });
}
