#!/usr/bin/env node
/**
 * UAT smoke — automated checks for staging / pre-acceptance.
 *
 * Usage:
 *   npm run uat:smoke
 *   APP_URL=http://localhost:4000 npm run uat:smoke
 *   npm run uat:smoke -- --db-only
 *   npm run uat:smoke -- --run-e2e
 *   npm run uat:smoke -- --json
 *
 * Env (from .env or shell):
 *   APP_URL / E2E_BASE_URL     — default http://127.0.0.1:8080 (staging nginx)
 *   CRON_SECRET                — cron hook auth
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   E2E_EMAIL / E2E_PASSWORD   — for --run-e2e
 */

import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "./lib/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const DB_ONLY = args.has("--db-only");
const RUN_E2E = args.has("--run-e2e");
const JSON_OUT = args.has("--json");

loadEnvFiles([".env"]);

const APP_URL = (
  process.env.APP_URL ??
  process.env.E2E_BASE_URL ??
  "http://127.0.0.1:8080"
).replace(/\/$/, "");

const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const CRON_SECRET = process.env.CRON_SECRET?.trim();

const results = [];
let failures = 0;
let skips = 0;

function record(name, status, detail = "") {
  results.push({ name, status, detail });
  if (status === "fail") failures += 1;
  if (status === "skip") skips += 1;
}

function pass(label, detail = "") {
  if (!JSON_OUT) console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  record(label, "pass", detail);
}

function fail(label, detail) {
  if (!JSON_OUT) console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  record(label, "fail", detail);
}

function skip(label, detail = "") {
  if (!JSON_OUT) console.log(`  skip ${label}${detail ? ` — ${detail}` : ""}`);
  record(label, "skip", detail);
}

function section(title) {
  if (!JSON_OUT) console.log(`\n${title}`);
}

async function checkHealth() {
  section("1. Application health");
  try {
    const res = await fetch(`${APP_URL}/api/health`);
    const body = await res.json();
    if (!res.ok || !body.ok) {
      fail("GET /api/health", JSON.stringify(body.checks ?? body));
      return;
    }
    pass("GET /api/health", `database=${body.checks?.database}, license=${body.checks?.license}`);
    if (body.checks?.database !== "ok") {
      fail("database check", body.checks?.database_error ?? body.checks?.database);
    }
    if (RUN_E2E && body.checks?.cron_secret === "missing") {
      fail("health cron_secret", "CRON_SECRET missing in production env");
    } else if (body.checks?.cron_secret === "ok") {
      pass("health cron_secret");
    }
  } catch (e) {
    fail("GET /api/health", e instanceof Error ? e.message : String(e));
  }
}

async function checkPublicRoutes() {
  section("2. Public routes");
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

async function checkRouteGuards() {
  section("3. Route guards (SSR shell)");
  const protectedPaths = ["/dashboard", "/documents/new", "/admin/settings"];
  for (const path of protectedPaths) {
    try {
      const res = await fetch(`${APP_URL}${path}`, { redirect: "manual" });
      // SPA may return 200 shell; client redirect happens in browser — E2E covers that.
      if (res.status === 200 || res.status === 307 || res.status === 302) {
        pass(`GET ${path}`, `status ${res.status}`);
      } else {
        fail(`GET ${path}`, `unexpected status ${res.status}`);
      }
    } catch (e) {
      fail(`GET ${path}`, e instanceof Error ? e.message : String(e));
    }
  }
  skip("client-side auth redirect", "covered by e2e/security-routes.spec.ts");
}

async function checkCronHooks() {
  section("4. Cron hooks");

  try {
    const res = await fetch(`${APP_URL}/api/public/hooks/email-dispatch`, { method: "POST" });
    if (res.status === 401 || res.status === 403) {
      pass("cron rejects missing Authorization");
    } else {
      fail("cron rejects missing Authorization", `expected 401/403, got ${res.status}`);
    }
  } catch (e) {
    fail("cron rejects missing Authorization", e instanceof Error ? e.message : String(e));
  }

  if (!CRON_SECRET) {
    if (RUN_E2E) {
      fail("CRON_SECRET", "required for uat:smoke:full — set in .env");
    } else {
      skip("cron hooks with CRON_SECRET", "set CRON_SECRET in .env");
    }
    return;
  }

  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (anonKey) {
    try {
      const res = await fetch(`${APP_URL}/api/public/hooks/email-dispatch`, {
        method: "POST",
        headers: { apikey: anonKey },
      });
      if (res.status === 401 || res.status === 403) {
        pass("cron rejects anon apikey");
      } else {
        fail("cron rejects anon apikey", `expected 401/403, got ${res.status}`);
      }
    } catch (e) {
      fail("cron rejects anon apikey", e instanceof Error ? e.message : String(e));
    }
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

async function checkOfficeCallback() {
  section("5. ONLYOFFICE callback");

  const forgedKey = "00000000-0000-0000-0000-000000000001-v1-0000000000000001";
  try {
    const res = await fetch(`${APP_URL}/api/public/hooks/office-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: forgedKey,
        status: 2,
        url: "http://169.254.169.254/latest/meta-data/",
      }),
    });
    if (res.status === 401 || res.status === 403) {
      pass("office-callback rejects unauthenticated save");
    } else {
      fail("office-callback rejects unauthenticated save", `expected 401/403, got ${res.status}`);
    }
  } catch (e) {
    fail("office-callback rejects unauthenticated save", e instanceof Error ? e.message : String(e));
  }
}

async function checkMigrations() {
  section("6. Pending migrations");
  const proc = spawnSync("npx", ["supabase", "migration", "list", "--linked"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (proc.status !== 0) {
    skip("supabase migration list", proc.stderr?.trim() || "not linked / CLI unavailable");
    return;
  }
  const pending = (proc.stdout ?? "")
    .split(/\r?\n/)
    .filter((line) => /^\s*\d{14}\s+\|\s+\|/.test(line));
  if (pending.length === 0) {
    pass("all migrations applied (linked project)");
  } else {
    fail("pending migrations", pending.join("; "));
  }
}

async function checkDatabase() {
  section("7. Database & security regression");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    skip("supabase RPC checks", "set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: license, error: licErr } = await sb.rpc("get_license_status");
  if (licErr) {
    fail("RPC get_license_status", licErr.message);
  } else {
    pass("RPC get_license_status", `status=${license?.status ?? "?"}`);
    if (license && !license.is_writable && license.status !== "grace") {
      skip("license writable", `status=${license.status}`);
    }
  }

  const fakeDoc = "00000000-0000-0000-0000-000000000099";
  const fakeUser = "00000000-0000-0000-0000-000000000088";

  for (const [label, fn] of [
    ["can_view_document", "can_view_document"],
    ["can_view_document_content", "can_view_document_content"],
  ]) {
    const { error } = await sb.rpc(fn, { _doc_id: fakeDoc, _user: fakeUser });
    if (error) {
      fail(`RPC ${label}`, error.message);
    } else {
      pass(`RPC ${label}(_doc_id, _user)`);
    }
  }

  const { data: swapped, error: swappedErr } = await sb.rpc("can_view_document", {
    _doc_id: fakeUser,
    _user: fakeDoc,
  });
  if (swappedErr) {
    fail("RPC can_view_document swapped-args sanity", swappedErr.message);
  } else if (swapped === true) {
    fail(
      "RLS can_view_document arg order",
      "swapped UUID args returned true — check migration 20260613100000",
    );
  } else {
    pass("RLS can_view_document arg order sanity");
  }

  await checkTenantIsolation(sb);
}

async function checkTenantIsolation(sb) {
  const { data: orgs, error: orgErr } = await sb.from("organization").select("id").limit(10);
  if (orgErr) {
    fail("tenant isolation org lookup", orgErr.message);
    return;
  }
  if (!orgs || orgs.length < 2) {
    skip("cross-tenant document isolation", "fewer than 2 organizations in database");
    return;
  }

  let tested = false;
  for (let i = 0; i < orgs.length && !tested; i++) {
    for (let j = 0; j < orgs.length && !tested; j++) {
      if (i === j) continue;

      const orgA = orgs[i].id;
      const orgB = orgs[j].id;

      const { data: userB, error: userErr } = await sb
        .from("profiles")
        .select("id")
        .eq("organization_id", orgB)
        .limit(1)
        .maybeSingle();
      const { data: docA, error: docErr } = await sb
        .from("documents")
        .select("id")
        .eq("organization_id", orgA)
        .limit(1)
        .maybeSingle();

      if (userErr) {
        fail("tenant isolation user lookup", userErr.message);
        return;
      }
      if (docErr) {
        fail("tenant isolation document lookup", docErr.message);
        return;
      }
      if (!userB?.id || !docA?.id) continue;

      for (const [label, fn] of [
        ["can_view_document", "can_view_document"],
        ["can_view_document_content", "can_view_document_content"],
      ]) {
        const { data: allowed, error } = await sb.rpc(fn, {
          _doc_id: docA.id,
          _user: userB.id,
        });
        if (error) {
          fail(`cross-tenant RPC ${label}`, error.message);
          return;
        }
        if (allowed === true) {
          fail(
            `cross-tenant ${label}`,
            `user ${userB.id} (org ${orgB}) must not access doc ${docA.id} (org ${orgA})`,
          );
          return;
        }
      }

      pass("cross-tenant document isolation", `orgA≠orgB, both RPCs false`);
      tested = true;
    }
  }

  if (!tested) {
    skip(
      "cross-tenant document isolation",
      "no cross-org user+document pair — run: npm run uat:seed-fixture",
    );
  }
}

async function runE2e() {
  section("8. Playwright security E2E");
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();
  if (!email || !password) {
    skip("playwright E2E", "set E2E_EMAIL and E2E_PASSWORD");
    return;
  }

  const proc = spawnSync(
    "npm",
    [
      "run",
      "test:e2e",
      "--",
      "e2e/health.spec.ts",
      "e2e/security-routes.spec.ts",
      "e2e/tenant-isolation.spec.ts",
    ],
    {
      cwd: root,
      stdio: JSON_OUT ? "pipe" : "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        E2E_BASE_URL: APP_URL,
        E2E_SKIP_SERVER: "1",
        CI: process.env.CI ?? "",
      },
    },
  );

  if (proc.status === 0) {
    pass("playwright health + security + tenant-isolation");
  } else {
    const detail = JSON_OUT ? proc.stdout?.slice(-500) ?? proc.stderr?.slice(-500) : "";
    fail("playwright health + security + tenant-isolation", detail || `exit ${proc.status}`);
  }
}

function printManualChecklist() {
  if (JSON_OUT) return;
  section("9. Manual UAT (remaining)");
  const items = [
    "KB publish blocked without document content access",
    "upsertDocumentCorrespondent requires document edit rights",
    "Contracts list requires contracts license",
    "Archive button hidden without archive_documents",
    "License settings read-only without admin_license.manage",
    "Integrations tab hidden without manage_integrations",
  ];
  for (const item of items) {
    console.log(`  [ ] ${item}`);
  }
  console.log("\n  Full checklist: docs/UAT.md");
}

function printSummary() {
  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          app_url: APP_URL,
          ok: failures === 0,
          failures,
          skips,
          results,
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log("");
  if (failures > 0) {
    console.error(`Smoke failed: ${failures} check(s), ${skips} skipped.`);
  } else {
    console.log(`Smoke passed (${skips} skipped).`);
  }
}

if (!JSON_OUT) console.log(`UAT smoke — ${APP_URL}`);

if (!DB_ONLY) {
  await checkHealth();
  await checkPublicRoutes();
  await checkRouteGuards();
  await checkCronHooks();
  await checkOfficeCallback();
}
await checkMigrations();
await checkDatabase();
if (RUN_E2E && !DB_ONLY) {
  await runE2e();
} else if (!DB_ONLY) {
  section("8. Playwright security E2E");
  skip("playwright E2E", "pass --run-e2e to execute");
}
printManualChecklist();
printSummary();

process.exit(failures > 0 ? 1 : 0);
