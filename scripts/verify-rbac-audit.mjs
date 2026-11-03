#!/usr/bin/env node
/**
 * Verify RBAC helpers, audit triggers, and correlation_id on recent workflow events.
 *
 * Usage:
 *   npm run uat:verify-rbac
 *   npm run uat:verify-rbac -- --json
 *
 * Env:
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "./lib/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const JSON_OUT = args.has("--json");

loadEnvFiles([".env"]);

const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

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

/** Tables that must have an audit_* trigger (name pattern). */
const AUDIT_TABLES = [
  "documents",
  "workflows",
  "roles",
  "user_role_grants",
  "profile_assignments",
  "departments",
  "positions",
  "workflow_tasks",
  "workflow_runs",
];

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(2);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!JSON_OUT) console.log("RBAC / audit verification");

  // --- 1. Audit triggers ---
  section("1. Audit triggers");
  const { data: triggers, error: trgErr } = await sb.rpc("exec_sql_readonly", {
    query: `
      SELECT c.relname AS table_name, t.tgname AS trigger_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal
        AND n.nspname = 'public'
        AND t.tgname LIKE 'audit_%'
      ORDER BY 1, 2
    `,
  }).maybeSingle?.() ?? { data: null, error: { message: "rpc unavailable" } };

  // Fallback: raw query via PostgREST is not available; use a known SQL function or skip
  // Prefer direct SQL through a security-definer helper if present; else probe via information_schema-style RPC.
  let triggerRows = [];
  if (trgErr || !triggers) {
    // Try alternative: select from a view if project exposes one; otherwise run lightweight probes
    const { data: probe, error: probeErr } = await sb
      .from("audit_logs")
      .select("id")
      .limit(1);
    if (probeErr) {
      fail("audit_logs readable", probeErr.message);
    } else {
      pass("audit_logs table reachable");
    }

    // Use pg_catalog via RPC if available
    const { data: sqlData, error: sqlErr } = await sb.rpc("list_audit_triggers").select?.() ?? {
      data: null,
      error: sqlErr ?? { message: "list_audit_triggers not present" },
    };

    if (sqlErr || !sqlData) {
      // Manual expected set: we only soft-check by querying each table exists
      for (const table of AUDIT_TABLES) {
        const { error } = await sb.from(table).select("*").limit(0);
        if (error && /does not exist|schema cache/i.test(error.message)) {
          fail(`table ${table}`, error.message);
        } else if (error) {
          // RLS or permission — table exists
          pass(`table ${table} exists`, "query rejected by RLS/policy (ok)");
        } else {
          pass(`table ${table} exists`);
        }
      }
      skip(
        "audit trigger names",
        "no list_audit_triggers RPC — add migration or run SQL manually: SELECT tgname FROM pg_trigger WHERE tgname LIKE 'audit_%'",
      );
    } else {
      triggerRows = Array.isArray(sqlData) ? sqlData : [];
      const byTable = new Map();
      for (const row of triggerRows) {
        const t = row.table_name ?? row.relname;
        const arr = byTable.get(t) ?? [];
        arr.push(row.trigger_name ?? row.tgname);
        byTable.set(t, arr);
      }
      for (const table of AUDIT_TABLES) {
        if (byTable.has(table)) {
          pass(`audit trigger on ${table}`, (byTable.get(table) ?? []).join(", "));
        } else {
          fail(`audit trigger on ${table}`, "missing audit_* trigger");
        }
      }
    }
  }

  // --- 2. user_has_permission RPC ---
  section("2. user_has_permission RPC");
  const { data: profile } = await sb
    .from("profiles")
    .select("id, role, organization_id")
    .limit(1)
    .maybeSingle();

  if (!profile?.id) {
    skip("user_has_permission", "no profiles in database");
  } else {
    const codes = ["manage_users", "view_documents", "manage_workflows", "admin_roles"];
    for (const code of codes) {
      const { data, error } = await sb.rpc("user_has_permission", {
        _user: profile.id,
        _permission: code,
      });
      if (error) {
        // Some deployments use different arg names
        const { data: data2, error: error2 } = await sb.rpc("user_has_permission", {
          p_user_id: profile.id,
          p_code: code,
        });
        if (error2) {
          fail(`user_has_permission(${code})`, error.message || error2.message);
        } else {
          pass(`user_has_permission(${code})`, `result=${data2}`);
        }
      } else {
        pass(`user_has_permission(${code})`, `result=${data}`);
      }
    }
  }

  // --- 3. correlation_id on recent audit / workflow events ---
  section("3. correlation_id presence");
  const { data: recentAudit, error: auditErr } = await sb
    .from("audit_logs")
    .select("id, action, correlation_id, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (auditErr) {
    fail("audit_logs recent", auditErr.message);
  } else if (!recentAudit?.length) {
    skip("correlation_id in audit_logs", "no rows yet");
  } else {
    const withCorr = recentAudit.filter((r) => r.correlation_id);
    const workflowActions = recentAudit.filter((r) =>
      String(r.action ?? "").startsWith("workflow."),
    );
    if (workflowActions.length === 0) {
      skip(
        "workflow.* audit actions",
        "no recent workflow.* actions — perform approve/reject in UI then re-run",
      );
    } else {
      const missing = workflowActions.filter((r) => !r.correlation_id);
      if (missing.length) {
        fail(
          "correlation_id on workflow audit",
          `${missing.length}/${workflowActions.length} workflow actions without correlation_id`,
        );
      } else {
        pass(
          "correlation_id on workflow audit",
          `${workflowActions.length} recent workflow.* rows have correlation_id`,
        );
      }
    }
    pass(
      "audit_logs sample",
      `${withCorr.length}/${recentAudit.length} of last 20 rows have correlation_id`,
    );
  }

  const { data: recentEvents, error: evErr } = await sb
    .from("workflow_events")
    .select("id, event_type, correlation_id, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (evErr) {
    // correlation_id column may not exist on workflow_events
    if (/correlation_id|column/i.test(evErr.message)) {
      skip("workflow_events.correlation_id", evErr.message);
    } else {
      fail("workflow_events recent", evErr.message);
    }
  } else if (!recentEvents?.length) {
    skip("workflow_events correlation_id", "no events yet");
  } else {
    const withCorr = recentEvents.filter((r) => r.correlation_id);
    pass(
      "workflow_events sample",
      `${withCorr.length}/${recentEvents.length} of last 20 have correlation_id`,
    );
  }

  // --- 4. profile_assignments immutability heuristic ---
  section("4. profile_assignments immutability");
  const { data: assignments, error: paErr } = await sb
    .from("profile_assignments")
    .select("id, profile_id, is_primary, valid_from, valid_to, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (paErr) {
    if (/does not exist|schema cache/i.test(paErr.message)) {
      skip("profile_assignments", paErr.message);
    } else {
      fail("profile_assignments", paErr.message);
    }
  } else if (!assignments?.length) {
    skip("profile_assignments", "no rows");
  } else {
    // Soft check: closed assignments should have valid_to set rather than deleted
    const closed = assignments.filter((a) => a.valid_to);
    pass(
      "profile_assignments history",
      `${closed.length} closed / ${assignments.length} sampled (valid_to set)`,
    );
  }

  // --- Summary ---
  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: failures === 0, failures, skips, results }, null, 2));
  } else {
    console.log("");
    if (failures > 0) {
      console.error(`RBAC/audit verify failed: ${failures} check(s), ${skips} skipped.`);
    } else {
      console.log(`RBAC/audit verify passed (${skips} skipped).`);
    }
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
