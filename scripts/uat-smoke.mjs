#!/usr/bin/env node
/**
 * UAT smoke — automated checks for staging / pre-acceptance.
 *
 * Usage:
 *   node scripts/uat-smoke.mjs
 *   APP_URL=http://localhost:3000 node scripts/uat-smoke.mjs
 *
 * Env (from .env or shell):
 *   APP_URL              — default http://127.0.0.1:3000
 *   CRON_SECRET          — optional cron hook check
 *   SUPABASE_URL         — optional DB/RLS regression checks
 *   SUPABASE_SERVICE_ROLE_KEY
 *   E2E_EMAIL / E2E_PASSWORD — hint for Playwright smoke
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

loadDotEnv(resolve(root, ".env"));

const APP_URL = (process.env.APP_URL ?? process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const CRON_SECRET = process.env.CRON_SECRET?.trim();

let failures = 0;
let skips = 0;

function pass(label) {
  console.log(`  ok   ${label}`);
}

function fail(label, detail) {
  console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  failures += 1;
}

function skip(label) {
  console.log(`  skip ${label}`);
  skips += 1;
}

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function checkHealth() {
  console.log("\n1. Application health");
  try {
    const res = await fetch(`${APP_URL}/api/health`);
    const body = await res.json();
    if (!res.ok || !body.ok) {
      fail("GET /api/health", JSON.stringify(body.checks ?? body));
      return;
    }
    pass(`GET /api/health (database=${body.checks?.database}, license=${body.checks?.license})`);
  } catch (e) {
    fail("GET /api/health", e instanceof Error ? e.message : String(e));
  }
}

async function checkAuthPage() {
  console.log("\n2. Public routes");
  try {
    const res = await fetch(`${APP_URL}/auth`, { redirect: "manual" });
    if (res.status >= 200 && res.status < 400) {
      pass("GET /auth");
    } else {
      fail("GET /auth", `status ${res.status}`);
    }
  } catch (e) {
    fail("GET /auth", e instanceof Error ? e.message : String(e));
  }
}

async function checkCronHooks() {
  console.log("\n3. Cron hooks");
  if (!CRON_SECRET) {
    skip("cron hooks — set CRON_SECRET");
    return;
  }
  const hooks = ["email-dispatch", "webhook-dispatch", "telegram-dispatch"];
  for (const hook of hooks) {
    try {
      const res = await fetch(`${APP_URL}/api/public/hooks/${hook}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      if (res.ok) {
        pass(`POST /api/public/hooks/${hook}`);
      } else {
        fail(`POST /api/public/hooks/${hook}`, `status ${res.status}`);
      }
    } catch (e) {
      fail(`POST /api/public/hooks/${hook}`, e instanceof Error ? e.message : String(e));
    }
  }
}

async function checkDatabase() {
  console.log("\n4. Database & security regression");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    skip("supabase checks — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: license, error: licErr } = await sb.rpc("get_license_status");
  if (licErr) {
    fail("RPC get_license_status", licErr.message);
  } else {
    pass(`RPC get_license_status (status=${license?.status ?? "?"})`);
  }

  const fakeDoc = "00000000-0000-0000-0000-000000000099";
  const fakeUser = "00000000-0000-0000-0000-000000000088";
  const { error: viewErr } = await sb.rpc("can_view_document", {
    _doc_id: fakeDoc,
    _user: fakeUser,
  });
  if (viewErr) {
    fail("RPC can_view_document(_doc_id, _user)", viewErr.message);
  } else {
    pass("RPC can_view_document accepts (_doc_id, _user) signature");
  }

  const { error: contentErr } = await sb.rpc("can_view_document_content", {
    _doc_id: fakeDoc,
    _user: fakeUser,
  });
  if (contentErr) {
    fail("RPC can_view_document_content", contentErr.message);
  } else {
    pass("RPC can_view_document_content callable");
  }
}

function checkE2eHint() {
  console.log("\n5. E2E workflow smoke");
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();
  if (email && password) {
    console.log(`  run  E2E_BASE_URL=${APP_URL} npm run test:e2e`);
    pass("E2E credentials configured");
  } else {
    skip("E2E — set E2E_EMAIL and E2E_PASSWORD, then npm run test:e2e");
  }
}

function printManualChecklist() {
  console.log("\n6. Manual UAT (recent security fixes)");
  const items = [
    "KB publish blocked without document content access",
    "upsertDocumentCorrespondent requires document edit rights",
    "Contracts list requires contracts license",
    "Archive button hidden without archive_documents",
    "License settings read-only without admin_license.manage",
    "Integrations tab hidden without manage_integrations",
    "/documents/new redirects without documents.write",
  ];
  for (const item of items) {
    console.log(`  [ ] ${item}`);
  }
  console.log("\n  Full checklist: docs/UAT.md");
}

console.log(`UAT smoke — ${APP_URL}`);

await checkHealth();
await checkAuthPage();
await checkCronHooks();
await checkDatabase();
checkE2eHint();
printManualChecklist();

console.log("");
if (failures > 0) {
  console.error(`Smoke failed: ${failures} check(s), ${skips} skipped.`);
  process.exit(1);
}
console.log(`Smoke passed (${skips} skipped).`);
