#!/usr/bin/env node
/**
 * Unified environment generator for Docker stacks.
 *
 * Usage:
 *   node scripts/env-setup.mjs [local|production|staging] [options]
 *
 * Options:
 *   --force              overwrite existing output file
 *   --rotate-secrets     regenerate JWT/keys even if output exists
 *   --install            (production) copy output → .env
 *   --domain=HOST        production domain (default: esedo.example.kz)
 *   --email=ADDR         Let's Encrypt email
 *   --with-license-server  production: встроенный license API (vendor)
 *   --license-domain=HOST  production: также создать .env.license-server
 *   --output=PATH        custom output path
 *   --dry-run            print to stdout, do not write
 *   --help
 *
 * npm shortcuts:
 *   npm run env:local
 *   npm run env:production -- --domain=esedo.example.kz --install
 *   npm run env:staging
 *   npm run env:license-server -- --domain=license.example.kz --install
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { syncSupabaseEnv } from "./lib/sync-supabase-env.mjs";
import {
  loadEnvValues,
  mergeEnvMaps,
  parseEnvValues,
  renderEnvFromTemplate,
} from "./lib/env-file.mjs";
import {
  PROFILES,
  TEMPLATE_FILE,
  buildHeader,
  buildProfileValues,
  printNextSteps,
  stripVendorSecrets,
} from "./lib/env-profiles.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.log(`Usage: node scripts/env-setup.mjs [profile] [options]

Profiles:
  local           ${PROFILES.local.label} → ${PROFILES.local.defaultOutput} (default)
  production      ${PROFILES.production.label} → ${PROFILES.production.defaultOutput}
  staging         ${PROFILES.staging.label} → ${PROFILES.staging.defaultOutput}
  license-server  ${PROFILES["license-server"].label} → ${PROFILES["license-server"].defaultOutput}

Options:
  --force           overwrite if output exists
  --rotate-secrets  new JWT/Postgres secrets (default: keep from --output / inherit files)
  --install         copy result to .env (production, license-server, staging)
  --domain=HOST     HTTPS domain (production / license-server)
  --email=ADDR      certbot email
  --license-secret=HEX   production: shared LICENSE_SIGNING_SECRET from vendor
  --license-server-url=URL production: online license URL for clients
  --with-license-server  production: LICENSE_SERVER_ENABLED=true на этом же домене
  --license-domain=HOST  production: дополнительно .env.license-server (другой VPS)
  --output=PATH     override output file
  --dry-run         stdout only
  --help            this message
`);
}

function parseArgs(argv) {
  const positional = [];
  const flags = new Set();
  const values = new Map();

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      flags.add("--help");
      continue;
    }
    if (arg.startsWith("--")) {
      if (arg.includes("=")) {
        const eq = arg.indexOf("=");
        values.set(arg.slice(0, eq), arg.slice(eq + 1));
      } else {
        flags.add(arg);
      }
      continue;
    }
    positional.push(arg);
  }

  return { positional, flags, values };
}

function resolveProfileId(positional) {
  const raw = positional[0]?.toLowerCase();
  if (!raw || raw === "local" || raw === "dev" || raw === "docker") return "local";
  if (raw === "production" || raw === "prod") return "production";
  if (raw === "staging" || raw === "uat") return "staging";
  if (raw === "license-server" || raw === "license" || raw === "licenseserver") return "license-server";
  console.error(`Unknown profile "${raw}". Use local, production, staging, or license-server.`);
  process.exit(1);
}

export function runEnvSetup(argv = process.argv.slice(2)) {
  const { positional, flags, values } = parseArgs(argv);

  if (flags.has("--help")) {
    usage();
    return 0;
  }

  const profileId = resolveProfileId(positional);
  const profile = PROFILES[profileId];
  const force = flags.has("--force");
  const rotateSecrets = flags.has("--rotate-secrets");
  const install = flags.has("--install");
  const dryRun = flags.has("--dry-run");

  const templatePath = resolve(root, TEMPLATE_FILE);
  if (!existsSync(templatePath)) {
    console.error(`Missing template: ${TEMPLATE_FILE}`);
    return 1;
  }

  const outputPath = resolve(
    root,
    values.get("--output") ?? profile.defaultOutput,
  );

  if (existsSync(outputPath) && !force && !install) {
    console.log(`${outputPath} already exists — use --force to regenerate.`);
    return 0;
  }

  const domain =
    values.get("--domain") ??
    process.env.PROXY_DOMAIN ??
    (profileId === "license-server" ? "license.example.kz" : "esedo.example.kz");
  const certEmail =
    values.get("--email") ??
    process.env.CERTBOT_EMAIL ??
    `admin@${domain}`;
  const publicUrl = `https://${domain}`;
  const licenseSecret = values.get("--license-secret") ?? null;
  const licenseServerUrl = values.get("--license-server-url") ?? null;
  const withLicenseServer = flags.has("--with-license-server");
  const licenseDomain = values.get("--license-domain")?.trim() || null;

  const inheritPaths = profile.inheritFrom.map((p) => resolve(root, p));
  const existingFromFiles = loadEnvValues(inheritPaths);
  const existingFromOutput = existsSync(outputPath)
    ? parseEnvValues(readFileSync(outputPath, "utf8"))
    : new Map();

  const existing = stripVendorSecrets(
    mergeEnvMaps(existingFromFiles, existingFromOutput),
    profileId,
  );

  const ctx = {
    profileId,
    domain,
    certEmail,
    publicUrl,
    licenseSecret,
    licenseServerUrl,
    withLicenseServer,
    licenseDomain,
    force,
    rotateSecrets,
    install,
    existing,
  };

  const profileValues = buildProfileValues(profileId, {
    ...ctx,
    rotateSecrets: rotateSecrets || (force && !existingFromFiles.size && !existingFromOutput.size),
  });

  const finalValues = mergeEnvMaps(existing, profileValues);
  const template = readFileSync(templatePath, "utf8");
  const body = renderEnvFromTemplate(template, finalValues);
  const header = buildHeader(profileId, ctx);
  const content = header + body.replace(/^# Flowmaster[^\n]*\n(?:# [^\n]*\n)*/m, "");

  if (dryRun) {
    process.stdout.write(content);
    return 0;
  }

  writeFileSync(outputPath, content, "utf8");
  console.log(`Created ${outputPath}`);
  if (profileId === "production" || profileId === "license-server") {
    console.log(`  Domain:  ${domain}`);
    console.log(`  App URL: ${publicUrl}`);
  }

  if (profileId === "production" && licenseDomain && licenseDomain !== domain) {
    const licenseOutput = resolve(root, PROFILES["license-server"].defaultOutput);
    const licenseExisting = stripVendorSecrets(
      mergeEnvMaps(
        loadEnvValues(inheritPaths),
        existsSync(licenseOutput) ? parseEnvValues(readFileSync(licenseOutput, "utf8")) : new Map(),
      ),
      "license-server",
    );
    const sharedSigning =
      finalValues.get("LICENSE_SIGNING_SECRET") ??
      licenseSecret ??
      licenseExisting.get("LICENSE_SIGNING_SECRET");
    if (sharedSigning) licenseExisting.set("LICENSE_SIGNING_SECRET", sharedSigning);

    const licensePublicUrl = `https://${licenseDomain}`;
    const licenseValues = buildProfileValues("license-server", {
      profileId: "license-server",
      domain: licenseDomain,
      certEmail,
      publicUrl: licensePublicUrl,
      licenseSecret: sharedSigning,
      licenseServerUrl: null,
      withLicenseServer: false,
      licenseDomain: null,
      force,
      rotateSecrets: false,
      install: false,
      existing: licenseExisting,
    });
    const licenseFinal = mergeEnvMaps(licenseExisting, licenseValues);
    const licenseBody = renderEnvFromTemplate(template, licenseFinal);
    const licenseHeader = buildHeader("license-server", {
      ...ctx,
      domain: licenseDomain,
      publicUrl: licensePublicUrl,
    });
    const licenseContent = licenseHeader + licenseBody.replace(/^# Flowmaster[^\n]*\n(?:# [^\n]*\n)*/m, "");
    writeFileSync(licenseOutput, licenseContent, "utf8");
    console.log(`Created ${licenseOutput}`);
    console.log(`  License domain: ${licenseDomain}`);
    console.log(`  License URL:    ${licensePublicUrl}`);
    console.log("  Запуск на отдельном VPS: npm run compose:license-server");
  }

  if (install) {
    const envPath = resolve(root, ".env");
    copyFileSync(outputPath, envPath);
    console.log(`Copied → ${envPath}`);
    ctx.installed = true;
  }

  const rootEnv = resolve(root, ".env");
  if (install || outputPath === rootEnv || profileId === "local") {
    const synced = syncSupabaseEnv(root);
    if (synced.ok) {
      console.log(`Synced → docker/supabase/.env`);
    }
  }

  printNextSteps(profileId, ctx);
  return 0;
}

if (process.argv[1]?.includes("env-setup")) {
  process.exit(runEnvSetup(process.argv.slice(2)));
}
