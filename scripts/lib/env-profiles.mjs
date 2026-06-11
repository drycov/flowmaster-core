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
    defaultOutput: ".env",
    inheritFrom: [".env"],
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
        APPLY_DB_SEED: "1",
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
        MONITORING_GRAFANA_URL: ctx.existing.get("MONITORING_GRAFANA_URL") ?? "http://127.0.0.1:3001",
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
        APPLY_DB_SEED: ctx.existing.get("APPLY_DB_SEED") ?? "1",
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
        "#   docker compose -f docker-compose.tls.yml up -d --build",
        "#   docker compose --profile cron up -d",
        `#   curl https://${ctx.domain}/api/health`,
        "#",
      );
      break;
    case "staging":
      lines.push(
        "# Запуск:",
        "#   npm run compose:staging",
        "#   curl http://localhost:8080/api/health",
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
      console.log("  3. docker compose -f docker-compose.tls.yml up -d --build");
      console.log("  4. docker compose --profile cron up -d");
      console.log(`  5. curl https://${ctx.domain}/api/health`);
      break;
    case "staging":
      console.log("Next steps:");
      console.log("  npm run compose:staging");
      console.log("  curl http://localhost:8080/api/health");
      break;
  }
}
