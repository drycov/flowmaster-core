import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SystemInitStatus = {
  has_organization: boolean;
  organization_configured: boolean;
  has_admin: boolean;
  admin_count: number;
  departments_count: number;
  permissions_count: number;
  roles_count: number;
  published_workflows: number;
  published_templates: number;
  /** No administrator yet — first-run signup is allowed. */
  needs_bootstrap: boolean;
  /** Post-install blocking setup (bootstrap, org, departments). */
  needs_setup: boolean;
  /** Any SetupChecklist step incomplete (includes workflows/templates). */
  setup_checklist_incomplete: boolean;
};

function isDefaultOrgName(name: string): boolean {
  return name === "" || name === "Моя организация";
}

function isDefaultOrgSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  return normalized === "" || normalized === "default";
}

function computeSetupFlags(input: {
  needsBootstrap: boolean;
  organizationConfigured: boolean;
  departmentsCount: number;
  hasAdmin: boolean;
  publishedWorkflows: number;
  publishedTemplates: number;
}): { needs_setup: boolean; setup_checklist_incomplete: boolean } {
  const needs_setup =
    input.needsBootstrap || !input.organizationConfigured || input.departmentsCount === 0;
  const setup_checklist_incomplete =
    !input.hasAdmin ||
    !input.organizationConfigured ||
    input.departmentsCount === 0 ||
    input.publishedWorkflows === 0 ||
    input.publishedTemplates === 0;
  return { needs_setup, setup_checklist_incomplete };
}

function parseInitStatus(data: unknown): SystemInitStatus {
  const row = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  const adminCount = Number(row.admin_count ?? 0);
  const needsBootstrap =
    row.needs_bootstrap === true ||
    (row.needs_bootstrap === undefined && adminCount === 0 && row.has_admin !== true);

  const organizationConfigured = row.organization_configured === true;
  const departmentsCount = Number(row.departments_count ?? 0);
  const publishedWorkflows = Number(row.published_workflows ?? 0);
  const publishedTemplates = Number(row.published_templates ?? 0);
  const hasAdmin = row.has_admin === true || adminCount > 0;

  const setupFlags =
    row.setup_checklist_incomplete !== undefined && row.needs_setup !== undefined
      ? {
          needs_setup: row.needs_setup === true,
          setup_checklist_incomplete: row.setup_checklist_incomplete === true,
        }
      : computeSetupFlags({
          needsBootstrap,
          organizationConfigured,
          departmentsCount,
          hasAdmin,
          publishedWorkflows,
          publishedTemplates,
        });

  return {
    has_organization: row.has_organization === true,
    organization_configured: organizationConfigured,
    has_admin: hasAdmin,
    admin_count: adminCount,
    departments_count: departmentsCount,
    permissions_count: Number(row.permissions_count ?? 0),
    roles_count: Number(row.roles_count ?? 0),
    published_workflows: publishedWorkflows,
    published_templates: publishedTemplates,
    needs_bootstrap: needsBootstrap,
    needs_setup: setupFlags.needs_setup,
    setup_checklist_incomplete: setupFlags.setup_checklist_incomplete,
  };
}

async function countAdminUsers(): Promise<number> {
  const { count: legacyCount } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin" as never);

  let adminN = legacyCount ?? 0;
  if (adminN > 0) return adminN;

  const { data: grantRows, error: grantErr } = await supabaseAdmin
    .from("user_role_grants")
    .select("user_id, roles!inner(code)")
    .is("revoked_at", null);
  if (grantErr) return adminN;

  const adminUsers = new Set<string>();
  for (const row of grantRows ?? []) {
    const role = (row as { roles?: { code?: string } }).roles;
    if (role?.code === "admin") {
      adminUsers.add((row as { user_id: string }).user_id);
    }
  }
  return adminUsers.size;
}

async function fallbackInitStatus(): Promise<SystemInitStatus> {
  const [
    { count: deptCount },
    { data: org },
    adminN,
    { count: wfCount },
    { count: tplCount },
  ] = await Promise.all([
    supabaseAdmin.from("departments").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("organization").select("name_ru, slug").limit(1).maybeSingle(),
    countAdminUsers(),
    supabaseAdmin
      .from("workflows")
      .select("id", { count: "exact", head: true })
      .eq("status", "published" as never),
    supabaseAdmin
      .from("document_templates")
      .select("id", { count: "exact", head: true })
      .eq("status", "published" as never),
  ]);

  const nameRu = (org as { name_ru?: string } | null)?.name_ru ?? "";
  const slug = (org as { slug?: string } | null)?.slug ?? "";
  const organizationConfigured = !!org && !isDefaultOrgName(nameRu) && !isDefaultOrgSlug(slug);
  const deptN = deptCount ?? 0;
  const needsBootstrap = adminN === 0;
  const wfN = wfCount ?? 0;
  const tplN = tplCount ?? 0;
  const setupFlags = computeSetupFlags({
    needsBootstrap,
    organizationConfigured,
    departmentsCount: deptN,
    hasAdmin: adminN > 0,
    publishedWorkflows: wfN,
    publishedTemplates: tplN,
  });

  return {
    has_organization: !!org,
    organization_configured: organizationConfigured,
    has_admin: adminN > 0,
    admin_count: adminN,
    departments_count: deptN,
    permissions_count: 0,
    roles_count: 0,
    published_workflows: wfN,
    published_templates: tplN,
    needs_bootstrap: needsBootstrap,
    needs_setup: setupFlags.needs_setup,
    setup_checklist_incomplete: setupFlags.setup_checklist_incomplete,
  };
}

/** Server-side system init snapshot (service_role RPC + admin fallback). */
export async function loadSystemInitStatus(): Promise<SystemInitStatus> {
  const { data, error } = await supabaseAdmin.rpc("get_system_init_status" as never);
  if (error) return fallbackInitStatus();
  return parseInitStatus(data);
}

export async function isBootstrapNeeded(): Promise<boolean> {
  return (await loadSystemInitStatus()).needs_bootstrap;
}
