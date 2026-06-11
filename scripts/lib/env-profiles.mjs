import { createSupabaseSecrets } from "./env-crypto.mjs";

export const TEMPLATE_FILE = ".env.docker.example";

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

export function buildProfileValues(profileId, ctx) {
  const secrets = createSupabaseSecrets(ctx.existing, { rotate: ctx.rotateSecrets });
  const base = { ...secrets };

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
        NGINX_HTTP_PORT: "80",
        NGINX_HTTPS_PORT: "443",
        PROXY_DOMAIN: "",
        CERTBOT_EMAIL: "",
        GRAFANA_ADMIN_PASSWORD: secrets.GRAFANA_ADMIN_PASSWORD,
        MONITORING_GRAFANA_URL: "http://127.0.0.1:3001",
      };

    case "production": {
      const { domain, certEmail, publicUrl } = ctx;
      return {
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
        ENABLE_EMAIL_AUTOCONFIRM: "false",
        DISABLE_SIGNUP: "false",
        NGINX_HTTP_PORT: "80",
        NGINX_HTTPS_PORT: "443",
        PROXY_DOMAIN: domain,
        CERTBOT_EMAIL: certEmail,
        SENTRY_ENVIRONMENT: "production",
        SMTP_ADMIN_EMAIL: ctx.existing.get("SMTP_ADMIN_EMAIL") ?? `admin@${domain}`,
        MONITORING_GRAFANA_URL: ctx.existing.get("MONITORING_GRAFANA_URL") ?? "http://127.0.0.1:3002",
        LICENSE_MODE: ctx.licenseServerUrl
          ? "online"
          : (ctx.existing.get("LICENSE_MODE") ?? "offline"),
        LICENSE_SIGNING_SECRET:
          ctx.licenseSecret ??
          ctx.existing.get("LICENSE_SIGNING_SECRET") ??
          "",
        LICENSE_SERVER_URL: ctx.licenseServerUrl ?? ctx.existing.get("LICENSE_SERVER_URL") ?? "",
      };
    }

    case "license-server": {
      const { domain, certEmail, publicUrl } = ctx;
      return {
        ...base,
        NODE_ENV: "production",
        LOG_LEVEL: "info",
        LICENSE_SERVER_ENABLED: "true",
        LICENSE_MODE: "offline",
        LICENSE_SIGNING_SECRET: secrets.LICENSE_SIGNING_SECRET,
        LICENSE_SERVER_ADMIN_SECRET: secrets.LICENSE_SERVER_ADMIN_SECRET,
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
        SMTP_ADMIN_EMAIL: ctx.existing.get("SMTP_ADMIN_EMAIL") ?? `admin@${domain}`,
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
        `# Regenerate: npm run env:production -- --domain=${ctx.domain} --force`,
        "# Установить как .env:",
        `#   npm run env:production -- --domain=${ctx.domain} --install`,
        "# Запуск:",
        "#   npm run compose:tls",
        "#   npm run compose:tls:cron",
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
        console.log("  2. npm run env:production -- --install   (или cp .env.production .env)");
      }
      console.log("  3. npm run compose:tls");
      console.log("  4. npm run compose:tls:cron");
      console.log("  5. npm run env:sync   (если compose ругается на docker/supabase/.env)");
      console.log("  6. curl http://127.0.0.1/api/health   (на сервере, до DNS)");
      console.log(`  7. curl https://${ctx.domain}/api/health   (после A-record DNS)`);
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
