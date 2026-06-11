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
  /** Post-install checklist (org, departments, optional content). */
  needs_setup: boolean;
};

function isDefaultOrgName(name: string): boolean {
  return name === "" || name === "Моя организация";
}

function isDefaultOrgSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  return normalized === "" || normalized === "default";
}

function parseInitStatus(data: unknown): SystemInitStatus {
  const row = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  const adminCount = Number(row.admin_count ?? 0);
  const needsBootstrap =
    row.needs_bootstrap === true ||
    (row.needs_bootstrap === undefined && adminCount === 0 && row.has_admin !== true);

  const organizationConfigured = row.organization_configured === true;
  const departmentsCount = Number(row.departments_count ?? 0);

  const needsSetup =
    row.needs_setup === true ||
    (row.needs_setup === undefined &&
      (needsBootstrap || !organizationConfigured || departmentsCount === 0));

  return {
    has_organization: row.has_organization === true,
    organization_configured: organizationConfigured,
    has_admin: row.has_admin === true || adminCount > 0,
    admin_count: adminCount,
    departments_count: departmentsCount,
    permissions_count: Number(row.permissions_count ?? 0),
    roles_count: Number(row.roles_count ?? 0),
    published_workflows: Number(row.published_workflows ?? 0),
    published_templates: Number(row.published_templates ?? 0),
    needs_bootstrap: needsBootstrap,
    needs_setup: needsSetup,
  };
}

async function fallbackInitStatus(): Promise<SystemInitStatus> {
  const [{ count: adminCount }, { count: deptCount }, { data: org }] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin" as never),
    supabaseAdmin.from("departments").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("organization").select("name_ru, slug").limit(1).maybeSingle(),
  ]);

  const nameRu = (org as { name_ru?: string } | null)?.name_ru ?? "";
  const slug = (org as { slug?: string } | null)?.slug ?? "";
  const organizationConfigured = !!org && !isDefaultOrgName(nameRu) && !isDefaultOrgSlug(slug);
  const adminN = adminCount ?? 0;
  const deptN = deptCount ?? 0;
  const needsBootstrap = adminN === 0;

  return {
    has_organization: !!org,
    organization_configured: organizationConfigured,
    has_admin: adminN > 0,
    admin_count: adminN,
    departments_count: deptN,
    permissions_count: 0,
    roles_count: 0,
    published_workflows: 0,
    published_templates: 0,
    needs_bootstrap: needsBootstrap,
    needs_setup: needsBootstrap || !organizationConfigured || deptN === 0,
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
