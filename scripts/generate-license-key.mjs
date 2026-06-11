#!/usr/bin/env node
/**
 * Generate a signed FM1 license key for FlowMaster / ЕСЭДО.
 *
 * Usage:
 *   node scripts/generate-license-key.mjs --plan professional --customer "Acme Corp"
 *   node scripts/generate-license-key.mjs --plan trial --max-users 5
 *   node scripts/generate-license-key.mjs --plan enterprise
 *
 * INSTALLATION_ID is resolved from .env or derived from SUPABASE_PROJECT_REF.
 * FM1 keys are signed with HMAC derived from installation_id (see signing.server.ts).
 */

import { createHash } from "node:crypto";
import { loadEnvFiles } from "./lib/load-env.mjs";
import { signLicensePayload } from "./lib/license-signing.mjs";

const KEY_PREFIX = "FM1";

function allFeatures() {
  return {
    workflows: true,
    templates: true,
    eds_signing: true,
    office: true,
    archive: true,
    references: true,
    nomenclature: true,
    audit: true,
    knowledge_base: true,
    projects: true,
    contracts: true,
    counterparties: true,
    hr: true,
    substitutions: true,
    correspondence: true,
    integrations: true,
    reports: true,
    monitoring: true,
  };
}

const CORE_FEATURES = {
  workflows: true,
  templates: true,
  eds_signing: true,
  archive: true,
  references: true,
  nomenclature: true,
  correspondence: true,
  substitutions: true,
  counterparties: true,
  office: false,
  reports: false,
  monitoring: false,
};

const PROFESSIONAL_FEATURES = {
  ...CORE_FEATURES,
  audit: true,
  knowledge_base: true,
  projects: true,
  contracts: true,
  hr: true,
  office: true,
  reports: true,
};

const PLAN_PRESETS = {
  trial: { max_users: 10, trial_days: 30, features: allFeatures() },
  standard: {
    max_users: 25,
    features: {
      ...CORE_FEATURES,
      audit: false,
      knowledge_base: false,
      projects: false,
      contracts: false,
      hr: false,
      integrations: false,
      office: false,
      reports: false,
      monitoring: false,
    },
  },
  professional: { max_users: 100, features: PROFESSIONAL_FEATURES },
  enterprise: { max_users: 9999, features: allFeatures() },
};

function loadEnvFile() {
  loadEnvFiles([".env", ".env.license-server", ".env.production"]);
}

function projectRef() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  let fromUrl = null;
  if (url) {
    try {
      fromUrl = new URL(url).hostname.split(".")[0] || null;
    } catch {
      fromUrl = null;
    }
  }
  return (
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    process.env.SUPABASE_PROJECT_ID?.trim() ||
    process.env.VITE_SUPABASE_PROJECT_ID?.trim() ||
    fromUrl ||
    null
  );
}

function installationIdFromSeed(seed) {
  const hash = createHash("sha256").update(seed).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function resolveInstallationId() {
  if (process.env.INSTALLATION_ID?.trim()) return process.env.INSTALLATION_ID.trim();
  const ref = projectRef();
  if (ref) return installationIdFromSeed(`flowmaster-install:${ref}`);
  return null;
}

function parseArgs(argv) {
  const args = { plan: "professional", customer: "", maxUsers: null, installationId: null, expiresAt: null, bind: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--plan" && argv[i + 1]) args.plan = argv[++i];
    else if (a === "--customer" && argv[i + 1]) args.customer = argv[++i];
    else if (a === "--max-users" && argv[i + 1]) args.maxUsers = Number(argv[++i]);
    else if (a === "--installation-id" && argv[i + 1]) args.installationId = argv[++i];
    else if (a === "--no-bind") args.bind = false;
    else if (a === "--expires-at" && argv[i + 1]) args.expiresAt = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/generate-license-key.mjs [options]

Options:
  --plan <trial|standard|professional|enterprise>  (default: professional)
  --customer <name>
  --max-users <n>
  --installation-id <uuid>   installation ID (required for signing; default from .env)
  --no-bind                  deprecated: keys always require installation_id
  --expires-at <ISO8601>
`);
      process.exit(0);
    }
  }
  return args;
}

function generateKey(args) {
  const preset = PLAN_PRESETS[args.plan];
  if (!preset) throw new Error(`Unknown plan: ${args.plan}`);

  let expiresAt = args.expiresAt;
  if (expiresAt === null) {
    if (args.plan === "enterprise") expiresAt = null;
    else if (args.plan === "trial") {
      expiresAt = new Date(Date.now() + preset.trial_days * 86400000).toISOString();
    } else {
      expiresAt = new Date(Date.now() + 365 * 86400000).toISOString();
    }
  }

  const installationId = args.bind
    ? args.installationId ?? resolveInstallationId()
    : args.installationId ?? null;

  if (!installationId) {
    throw new Error("Set INSTALLATION_ID in .env or pass --installation-id (required for signing)");
  }

  const payload = {
    v: 1,
    plan: args.plan,
    max_users: args.maxUsers ?? preset.max_users,
    features: preset.features,
    expires_at: expiresAt,
    customer: args.customer,
    installation_id: installationId,
    issued_at: new Date().toISOString(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = signLicensePayload(encodedPayload, installationId);
  return `${KEY_PREFIX}.${encodedPayload}.${sig}`;
}

loadEnvFile();
const args = parseArgs(process.argv.slice(2));
const key = generateKey(args);
const boundId = args.bind ? args.installationId ?? resolveInstallationId() : args.installationId ?? null;
console.log(key);
console.error(`\nplan=${args.plan}`);
if (boundId) console.error(`installation_id=${boundId}`);
console.error(`hash=${createHash("sha256").update(key).digest("hex").slice(0, 16)}…`);
