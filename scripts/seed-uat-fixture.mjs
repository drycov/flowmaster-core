#!/usr/bin/env node
/**
 * Idempotent UAT fixture: second tenant + cross-tenant document for smoke/E2E.
 *
 *   npm run uat:seed-fixture
 *   npm run uat:seed-fixture -- --print-env
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from .env).
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles } from "./lib/load-env.mjs";

loadEnvFiles([".env", ".env.staging"]);

const args = new Set(process.argv.slice(2));
const PRINT_ENV = args.has("--print-env");
const JSON_OUT = args.has("--json");

const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const FIXTURE = {
  orgBSlug: "uat-tenant-b",
  orgBId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  docId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  userAEmail: process.env.UAT_FIXTURE_A_EMAIL?.trim() ?? "uat-a-admin@fixture.local",
  userBEmail: process.env.UAT_FIXTURE_B_EMAIL?.trim() ?? "uat-b-viewer@fixture.local",
  password: process.env.UAT_FIXTURE_PASSWORD?.trim() ?? "UatFixture1!",
  docRegNumber: "UAT-FIXTURE-001",
};

function fail(message) {
  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  } else {
    console.error(message);
  }
  process.exit(1);
}

async function ensureUser(sb, { email, password, orgId, fullNameRu, fullNameKk, role }) {
  const { data: existing, error: lookupErr } = await sb
    .from("profiles")
    .select("id")
    .eq("organization_id", orgId)
    .ilike("email", email)
    .maybeSingle();

  if (lookupErr) throw new Error(lookupErr.message);
  if (existing?.id) return existing.id;

  const { data: userId, error } = await sb.rpc("register_app_user", {
    p_email: email,
    p_password: password,
    p_full_name_ru: fullNameRu,
    p_full_name_kk: fullNameKk,
    p_locale: "ru",
    p_iin: null,
    p_auth_method: "email",
    p_organization_id: orgId,
  });

  if (error) throw new Error(error.message);
  if (!userId) throw new Error(`register_app_user returned no id for ${email}`);

  if (role && role !== "viewer") {
    const { error: roleErr } = await sb.rpc("grant_app_role", {
      _user: userId,
      _role: role,
      _reason: "uat_fixture",
    });
    if (roleErr) throw new Error(roleErr.message);
  }

  return userId;
}

async function ensureOrgB(sb, orgAId) {
  const { data: bySlug, error: slugErr } = await sb
    .from("organization")
    .select("id")
    .eq("slug", FIXTURE.orgBSlug)
    .maybeSingle();
  if (slugErr) throw new Error(slugErr.message);
  if (bySlug?.id) return bySlug.id;

  const { data: orgs, error: orgErr } = await sb
    .from("organization")
    .select("id")
    .neq("id", orgAId)
    .limit(1);
  if (orgErr) throw new Error(orgErr.message);
  if (orgs?.[0]?.id) return orgs[0].id;

  const { data: inserted, error: insertErr } = await sb
    .from("organization")
    .insert({
      id: FIXTURE.orgBId,
      name_ru: "UAT Tenant B",
      name_kk: "UAT Tenant B",
      short_name_ru: "UAT-B",
      short_name_kk: "UAT-B",
      slug: FIXTURE.orgBSlug,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(insertErr.message);
  return inserted.id;
}

async function ensureDocument(sb, { orgId, createdBy }) {
  const { data: existing, error: lookupErr } = await sb
    .from("documents")
    .select("id")
    .eq("id", FIXTURE.docId)
    .maybeSingle();
  if (lookupErr) throw new Error(lookupErr.message);
  if (existing?.id) return existing.id;

  const { data: inserted, error: insertErr } = await sb
    .from("documents")
    .insert({
      id: FIXTURE.docId,
      organization_id: orgId,
      created_by: createdBy,
      title_ru: "UAT: cross-tenant isolation fixture",
      title_kk: "UAT: cross-tenant isolation fixture",
      reg_number: FIXTURE.docRegNumber,
      doc_type: "internal",
      status: "draft",
      body: "Fixture document for automated tenant isolation checks.",
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(insertErr.message);
  return inserted.id;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    fail("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: orgA, error: orgAErr } = await sb
    .from("organization")
    .select("id, name_ru")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgAErr) fail(orgAErr.message);
  if (!orgA?.id) {
    fail("No organization in database — complete first-run bootstrap at /auth first");
  }

  const orgBId = await ensureOrgB(sb, orgA.id);

  const userAId = await ensureUser(sb, {
    email: FIXTURE.userAEmail,
    password: FIXTURE.password,
    orgId: orgA.id,
    fullNameRu: "UAT Admin A",
    fullNameKk: "UAT Admin A",
    role: "admin",
  });

  const userBId = await ensureUser(sb, {
    email: FIXTURE.userBEmail,
    password: FIXTURE.password,
    orgId: orgBId,
    fullNameRu: "UAT Viewer B",
    fullNameKk: "UAT Viewer B",
    role: "viewer",
  });

  const docId = await ensureDocument(sb, { orgId: orgA.id, createdBy: userAId });

  const { data: canView, error: rpcErr } = await sb.rpc("can_view_document", {
    _doc_id: docId,
    _user: userBId,
  });
  if (rpcErr) fail(rpcErr.message);
  if (canView === true) {
    fail("Fixture sanity failed: user B must not can_view_document for org A document");
  }

  const result = {
    ok: true,
    org_a_id: orgA.id,
    org_b_id: orgBId,
    user_a_id: userAId,
    user_b_id: userBId,
    document_id: docId,
    e2e: {
      E2E_EMAIL: FIXTURE.userAEmail,
      E2E_PASSWORD: FIXTURE.password,
      E2E_TENANT_B_EMAIL: FIXTURE.userBEmail,
      E2E_TENANT_B_PASSWORD: FIXTURE.password,
      E2E_CROSS_TENANT_DOCUMENT_ID: docId,
    },
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("UAT fixture ready");
  console.log(`  org A: ${orgA.name_ru} (${orgA.id})`);
  console.log(`  org B: ${orgBId}`);
  console.log(`  user A: ${FIXTURE.userAEmail}`);
  console.log(`  user B: ${FIXTURE.userBEmail}`);
  console.log(`  document: ${docId} (${FIXTURE.docRegNumber})`);
  console.log("");
  console.log("Cross-tenant RPC sanity: can_view_document(user B) = false");

  if (PRINT_ENV) {
    console.log("");
    console.log("# Add to .env for uat:smoke:full / test:e2e:security");
    for (const [key, value] of Object.entries(result.e2e)) {
      console.log(`${key}=${value}`);
    }
  } else {
    console.log("");
    console.log("Run: npm run uat:seed-fixture -- --print-env");
    console.log("Then: npm run uat:smoke:db");
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
