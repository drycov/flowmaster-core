import { createSupabaseSecrets, installationIdFromDomain } from "./env-crypto.mjs";

export const TEMPLATE_FILE = ".env.docker.example";

/** Vendor cloud license server (Vercel). EDMS never embeds license API on the same host. */
export const DEFAULT_CLOUD_LICENSE_URL = "https://z-license.vercel.app";

/** ONLYOFFICE vars shared by app and documentserver containers (Docker network). */
function onlyofficeDockerEnv(secrets, jwtEnabled = false) {
  return {
    ONLYOFFICE_CALLBACK_BASE_URL: "http://nginx",
    ONLYOFFICE_STORAGE_INTERNAL_URL: "http://kong:8000",
    ONLYOFFICE_HTTP_PORT: "8082",
    ONLYOFFICE_JWT_ENABLED: jwtEnabled ? "true" : "false",
    ONLYOFFICE_JWT_SECRET: secrets.ONLYOFFICE_JWT_SECRET,
  };
}

/** Client profiles must not inherit vendor-only license-server secrets. */
function clientSecrets(secrets) {
  const { LICENSE_SERVER_ADMIN_SECRET: _admin, ...rest } = secrets;
  return rest;
}

export const PROFILES = {
  local: {
    id: "local",
    label: "Local Docker (nginx + localhost)",
    defaultOutput: ".env",
    inheritFrom: [],
  },
  production: {
    id: "production",
    label: "Production (HTTPS, один домен)",
    defaultOutput: ".env.production",
    inheritFrom: [".env", ".env.production"],
  },
  staging: {
    id: "staging",
    label: "Staging / UAT",
    defaultOutput: ".env.staging",
    inheritFrom: [".env.staging"],
  },
  "license-server": {
    id: "license-server",
    label: "License server (vendor)",
    defaultOutput: ".env.license-server",
    inheritFrom: [".env", ".env.license-server"],
  },
};

const CLIENT_PROFILE_IDS = new Set(["local", "production", "staging"]);

/** Keys that belong only to the vendor license-server profile. */
const LICENSE_SERVER_ONLY_KEYS = [
  "LICENSE_SERVER_ADMIN_SECRET",
  "LICENSE_SERVER_ENABLED",
  "LICENSE_SERVER_LOCAL_ADMIN",
];

export function stripVendorSecrets(existing, profileId) {
  if (!CLIENT_PROFILE_IDS.has(profileId)) return existing;
  for (const key of LICENSE_SERVER_ONLY_KEYS) {
    existing.delete(key);
  }
  return existing;
}

function resolveProductionInstallationId(ctx, domain) {
  const explicit = ctx.installationId?.trim();
  if (explicit) return explicit;

  if (
    !ctx.rotateSecrets &&
    ctx.existing.get("INSTALLATION_ID") &&
    (ctx.existing.get("PROXY_DOMAIN") === domain || ctx.licenseServerUrl)
  ) {
    return ctx.existing.get("INSTALLATION_ID");
  }

  return installationIdFromDomain(domain);
}

export function buildProfileValues(profileId, ctx) {
  const secrets = createSupabaseSecrets(ctx.existing, { rotate: ctx.rotateSecrets });
  const base = clientSecrets(secrets);

  switch (profileId) {
    case "local":
      return {
        ...base,
        NODE_ENV: "production",
        LOG_LEVEL: "info",
        APP_URL: "http://localhost",
        PUBLIC_APP_URL: "http://localhost",
        DISABLE_TELEGRAM_POLLING: "true",
        VITE_SUPABASE_URL: "http://localhost",
        SUPABASE_URL: "http://localhost:54321",
        SUPABASE_PUBLIC_URL: "http://localhost",
        API_EXTERNAL_URL: "http://localhost",
        SITE_URL: "http://localhost",
        KONG_HTTP_PORT: "54321",
        KONG_HTTPS_PORT: "8443",
        STUDIO_DEFAULT_ORGANIZATION: "Flowmaster",
        STUDIO_DEFAULT_PROJECT: "Local",
        POOLER_TENANT_ID: ctx.existing.get("POOLER_TENANT_ID") ?? "flowmaster-local",
        APPLY_DB_MIGRATIONS: "1",
        APPLY_DB_SEED: "0",
        ENABLE_EMAIL_AUTOCONFIRM: "true",
        ...onlyofficeDockerEnv(secrets),
        NGINX_HTTP_PORT: "80",
        NGINX_HTTPS_PORT: "443",
        PROXY_DOMAIN: "",
        CERTBOT_EMAIL: "",
        GRAFANA_ADMIN_PASSWORD: secrets.GRAFANA_ADMIN_PASSWORD,
        MONITORING_GRAFANA_URL: "http://127.0.0.1:3001",
        INSTALLATION_ID:
          !ctx.rotateSecrets &&
          ctx.existing.get("INSTALLATION_ID") &&
          !ctx.existing.get("PROXY_DOMAIN")
            ? ctx.existing.get("INSTALLATION_ID")
            : installationIdFromDomain("localhost"),
      };

    case "production": {
      const { domain, certEmail, publicUrl } = ctx;
      const signingSecret =
        ctx.licenseSecret ??
        ctx.existing.get("LICENSE_SIGNING_SECRET") ??
        base.LICENSE_SIGNING_SECRET ??
        "";
      const production = {
        ...base,
        NODE_ENV: "production",
        LOG_LEVEL: "info",
        APP_URL: publicUrl,
        PUBLIC_APP_URL: publicUrl,
        CRON_SECRET: secrets.CRON_SECRET,
        DISABLE_TELEGRAM_POLLING: "true",
        REPLICA_COUNT: ctx.existing.get("REPLICA_COUNT") ?? "1",
        VITE_SUPABASE_URL: publicUrl,
        SUPABASE_URL: publicUrl,
        SUPABASE_PUBLIC_URL: publicUrl,
        API_EXTERNAL_URL: publicUrl,
        SITE_URL: publicUrl,
        KONG_HTTP_PORT: "54321",
        KONG_HTTPS_PORT: "8443",
        STUDIO_DEFAULT_ORGANIZATION: "ЕСЭДО",
        STUDIO_DEFAULT_PROJECT: "Production",
        POOLER_TENANT_ID: ctx.existing.get("POOLER_TENANT_ID") ?? "flowmaster-prod",
        APPLY_DB_MIGRATIONS: "1",
        APPLY_DB_SEED: "0",
        ...onlyofficeDockerEnv(secrets, true),
        ENABLE_EMAIL_AUTOCONFIRM: "false",
        DISABLE_SIGNUP: "false",
        NGINX_HTTP_PORT: "80",
        NGINX_HTTPS_PORT: "443",
        PROXY_DOMAIN: domain,
        CERTBOT_EMAIL: certEmail,
        SENTRY_ENVIRONMENT: "production",
        SMTP_ADMIN_EMAIL: ctx.force
          ? certEmail
          : (ctx.existing.get("SMTP_ADMIN_EMAIL") ?? certEmail),
        MONITORING_GRAFANA_URL: ctx.existing.get("MONITORING_GRAFANA_URL") ?? "http://127.0.0.1:3001",
        LICENSE_SIGNING_SECRET: signingSecret,
        LICENSE_SERVER_URL: ctx.licenseServerUrl ?? ctx.existing.get("LICENSE_SERVER_URL") ?? "",
        INSTALLATION_ID: resolveProductionInstallationId(ctx, domain),
      };

      const externalLicenseUrl = (ctx.licenseServerUrl ?? "").trim();
      const cloudLicenseUrl =
        externalLicenseUrl || (ctx.withLicenseServer ? DEFAULT_CLOUD_LICENSE_URL : "");

      if (ctx.licenseReplica && ctx.licenseDomain && cloudLicenseUrl) {
        // Фаза 2: EDMS → Local LS (replica) → z-license cloud master
        production.LICENSE_MODE = "online";
        production.LICENSE_SERVER_URL = `https://${ctx.licenseDomain}`.replace(/\/$/, "");
      } else if (cloudLicenseUrl) {
        // EDMS (on-prem Docker) ↔ z-license (Vercel)
        production.LICENSE_MODE = "online";
        production.LICENSE_SERVER_URL = cloudLicenseUrl.replace(/\/$/, "");
      } else if (ctx.existing.get("LICENSE_MODE") === "online") {
        production.LICENSE_MODE = "online";
      } else {
        production.LICENSE_MODE = ctx.existing.get("LICENSE_MODE") ?? "offline";
      }

      if (ctx.licenseDomain && ctx.licenseDomain !== domain && !cloudLicenseUrl) {
        production.LICENSE_MODE = "online";
        production.LICENSE_SERVER_URL = `https://${ctx.licenseDomain}`;
      }

      return production;
    }

    case "license-server": {
      const { domain, certEmail, publicUrl } = ctx;
      const upstreamUrl = ctx.licenseReplica
        ? (ctx.licenseServerUrl ?? "").trim().replace(/\/$/, "")
        : "";
      const installationId =
        ctx.installationId?.trim() ||
        (!ctx.rotateSecrets &&
        ctx.existing.get("INSTALLATION_ID") &&
        ctx.existing.get("PROXY_DOMAIN") === domain
          ? ctx.existing.get("INSTALLATION_ID")
          : installationIdFromDomain(domain));
      return {
        ...base,
        NODE_ENV: "production",
        LOG_LEVEL: "info",
        LICENSE_SERVER_ENABLED: "true",
        LICENSE_MODE: ctx.licenseReplica ? "online" : "offline",
        LICENSE_UPSTREAM_URL: upstreamUrl,
        LICENSE_SIGNING_SECRET:
          ctx.licenseSecret ?? secrets.LICENSE_SIGNING_SECRET,
        LICENSE_SERVER_ADMIN_SECRET: secrets.LICENSE_SERVER_ADMIN_SECRET,
        CRON_SECRET: secrets.CRON_SECRET,
        APP_URL: publicUrl,
        PUBLIC_APP_URL: publicUrl,
        DISABLE_TELEGRAM_POLLING: "true",
        DISABLE_SIGNUP: "true",
        REPLICA_COUNT: "1",
        VITE_SUPABASE_URL: publicUrl,
        SUPABASE_URL: publicUrl,
        SUPABASE_PUBLIC_URL: publicUrl,
        API_EXTERNAL_URL: publicUrl,
        SITE_URL: publicUrl,
        KONG_HTTP_PORT: "54321",
        KONG_HTTPS_PORT: "8443",
        STUDIO_DEFAULT_ORGANIZATION: "Flowmaster License",
        STUDIO_DEFAULT_PROJECT: "LicenseServer",
        POOLER_TENANT_ID: ctx.existing.get("POOLER_TENANT_ID") ?? "flowmaster-license",
        APPLY_DB_MIGRATIONS: "1",
        APPLY_DB_SEED: "0",
        ENABLE_EMAIL_AUTOCONFIRM: "false",
        NGINX_HTTP_PORT: "80",
        NGINX_HTTPS_PORT: "443",
        PROXY_DOMAIN: domain,
        CERTBOT_EMAIL: certEmail,
        SENTRY_ENVIRONMENT: "license-server",
        SMTP_ADMIN_EMAIL: ctx.existing.get("SMTP_ADMIN_EMAIL") ?? certEmail,
        INSTALLATION_ID: installationId,
      };
    }

    case "staging":
      return {
        ...base,
        NODE_ENV: "production",
        LOG_LEVEL: "debug",
        STAGING_PORT: "3001",
        STAGING_NGINX_PORT: "8080",
        APP_URL: "http://localhost:8080",
        PUBLIC_APP_URL: "http://localhost:8080",
        VITE_SUPABASE_URL: "http://localhost:54321",
        SUPABASE_URL: "http://kong:8000",
        SUPABASE_PUBLIC_URL: "http://localhost:54321",
        API_EXTERNAL_URL: "http://localhost:54321",
        SITE_URL: "http://localhost:8080",
        KONG_HTTP_PORT: "54321",
        DISABLE_TELEGRAM_POLLING: "true",
        CRON_INTERVAL_SEC: "60",
        POOLER_TENANT_ID: ctx.existing.get("POOLER_TENANT_ID") ?? "flowmaster-staging",
        APPLY_DB_MIGRATIONS: "1",
        APPLY_DB_SEED: ctx.existing.get("APPLY_DB_SEED") ?? "0",
        SENTRY_ENVIRONMENT: "staging",
        NGINX_HTTP_PORT: "80",
        NGINX_HTTPS_PORT: "443",
      };

    default:
      throw new Error(`Unknown profile: ${profileId}`);
  }
}

export function buildHeader(profileId, ctx) {
  const stamp = new Date().toISOString().slice(0, 10);
  const lines = [
    `# ЕСЭДО / Flowmaster — ${PROFILES[profileId].label}`,
    `# Сгенерировано: ${stamp}`,
    `# Команда: npm run env:${profileId}${ctx.force ? " -- --force" : ""}`,
    "#",
  ];

  switch (profileId) {
    case "local":
      lines.push(
        "# Запуск:",
        "#   npm run docker:up",
        "#   curl http://localhost/api/health",
        "# Dev (Supabase в Docker, app на хосте):",
        "#   npm run docker:deps && npm run dev",
        "#",
      );
      break;
    case "production":
      lines.push(
        `# Домен: ${ctx.domain}`,
        `# ONLYOFFICE (админка): ${ctx.publicUrl}/onlyoffice`,
        `# Regenerate: npm run env:production -- --domain=${ctx.domain} --force`,
        "# Установить как .env:",
        `#   npm run env:production -- --domain=${ctx.domain} --email=... --install`,
        ...(ctx.withLicenseServer || ctx.licenseServerUrl || ctx.licenseDomain
          ? ctx.licenseServerUrl || ctx.withLicenseServer
            ? [
                "# Связка EDMS ↔ z-license (online-клиент):",
                `#   LICENSE_SERVER_URL=${ctx.licenseServerUrl ?? DEFAULT_CLOUD_LICENSE_URL}`,
                ...(ctx.installationId ? [`#   INSTALLATION_ID=${ctx.installationId}`] : []),
                "#   npm run docker:up -- --tls --cron",
              ]
            : [
                `# License replica VPS: ${ctx.licenseDomain}`,
                "#   npm run env:license-server -- --domain=license.example.kz --license-replica --license-server-url=https://z-license.vercel.app",
              ]
          : []),
        ...(ctx.licenseDomain && ctx.licenseDomain !== ctx.domain
          ? [`# License server (отдельный VPS): ${ctx.licenseDomain}`]
          : []),
        "# Запуск:",
        "#   npm run docker:up -- --tls",
        "#   npm run docker:up -- --tls --cron",
        `#   curl https://${ctx.domain}/api/health`,
        "#",
      );
      break;
    case "staging":
      lines.push(
        "# Запуск:",
        "#   npm run env:staging",
        "#   npm run compose:staging",
        "#   curl http://localhost:8080/api/health",
        "#",
      );
      break;
    case "license-server":
      lines.push(
        `# Домен license server: ${ctx.domain}`,
        `# Regenerate: npm run env:license-server -- --domain=${ctx.domain} --force`,
        "# Установить как .env:",
        `#   npm run env:license-server -- --domain=${ctx.domain} --install`,
        "# Запуск:",
        "#   npm run compose:license-server",
        `#   curl https://${ctx.domain}/api/v1/license/health`,
        "#",
        "# LICENSE_SIGNING_SECRET — тот же секрет укажите у клиентов (npm run env:production -- --license-secret=...)",
        "#",
      );
      break;
  }

  return `${lines.join("\n")}\n\n`;
}

export function printNextSteps(profileId, ctx) {
  console.log("");
  switch (profileId) {
    case "local":
      console.log("Next steps:");
      console.log("  npm run docker:up");
      console.log("  curl http://localhost/api/health");
      console.log("  open http://localhost/auth");
      break;
    case "production":
      console.log("Next steps:");
      console.log(`  1. DNS A-record: ${ctx.domain} → server IP`);
      if (!ctx.installed) {
        console.log(
          ctx.withLicenseServer
            ? `  2. npm run env:production -- --domain=${ctx.domain} --with-license-server --installation-id=<uuid> --install`
            : "  2. npm run env:production -- --install   (или cp .env.production .env)",
        );
      }
      console.log("  3. npm run docker:up -- --tls");
      console.log("  4. npm run docker:up -- --tls --cron");
      console.log("  5. npm run env:sync   (если compose ругается на docker/supabase/.env)");
      console.log("  6. curl http://127.0.0.1/api/health   (на сервере, до DNS)");
      console.log(`  7. curl https://${ctx.domain}/api/health   (после A-record DNS)`);
      if (ctx.licenseServerUrl || ctx.withLicenseServer) {
        const licenseUrl = (ctx.licenseServerUrl ?? DEFAULT_CLOUD_LICENSE_URL).replace(/\/$/, "");
        console.log(`  8. curl ${licenseUrl}/api/v1/license/health`);
        console.log(`  9. curl https://${ctx.domain}/api/health`);
        console.log(" 10. Админка → Настройки → Лицензия → «Синхронизировать»");
      } else if (ctx.licenseDomain && ctx.licenseDomain !== ctx.domain) {
        console.log(`  8. На VPS license: npm run compose:license-server`);
        console.log(`  9. curl https://${ctx.licenseDomain}/api/v1/license/health`);
      }
      console.log(
        `  ONLYOFFICE: Настройки → Интеграции → URL ${ctx.publicUrl}/onlyoffice`,
      );
      break;
    case "staging":
      console.log("Next steps:");
      console.log("  npm run env:staging -- --install");
      console.log("  npm run env:sync");
      console.log("  npm run compose:staging");
      console.log("  curl http://localhost:8080/api/health");
      break;
    case "license-server":
      console.log("Next steps:");
      console.log(`  1. DNS A-record: ${ctx.domain} → server IP`);
      if (!ctx.installed) {
        console.log("  2. npm run env:license-server -- --install   (или cp .env.license-server .env)");
      }
      console.log("  3. npm run compose:license-server");
      console.log(`  4. curl https://${ctx.domain}/api/v1/license/health`);
      console.log("  5. npm run license:generate -- --plan professional --customer \"Acme\"");
      console.log("  6. npm run license:server -- register --key \"FM1....\"");
      console.log("");
      console.log("Сохраните LICENSE_SIGNING_SECRET — тот же секрет нужен на инсталляциях клиентов:");
      console.log("  npm run env:production -- --domain=client.kz --license-secret=<LICENSE_SIGNING_SECRET>");
      break;
  }
}
