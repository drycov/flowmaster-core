import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantContext } from "./tenant";

type OrganizationTenantRow = {
  id: string;
  slug: string | null;
  name_ru: string | null;
  tenant_mode: string | null;
};

/** Resolve tenant from organization row(s). Single-org installs return the first row. */
export async function resolveTenantFromOrganization(
  supabase: SupabaseClient,
  opts?: { slug?: string | null },
): Promise<TenantContext> {
  if (opts?.slug) {
    return resolveTenantFromSlug(supabase, opts.slug);
  }

  const { data, error } = await supabase
    .from("organization")
    .select("id, slug, name_ru, tenant_mode")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Tenant resolution failed: ${error.message}`);
  if (!data) {
    return { id: "default", name: null, mode: "single" };
  }

  return mapOrganizationRow(data as OrganizationTenantRow);
}

export async function resolveTenantFromOrganizationId(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<TenantContext> {
  const { data, error } = await supabase
    .from("organization")
    .select("id, slug, name_ru, tenant_mode")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw new Error(`Tenant resolution failed: ${error.message}`);
  if (!data) {
    return { id: organizationId, name: null, mode: "single" };
  }

  return mapOrganizationRow(data as OrganizationTenantRow);
}

export async function resolveTenantFromSlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<TenantContext> {
  const { data, error } = await supabase
    .from("organization")
    .select("id, slug, name_ru, tenant_mode")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();

  if (error) throw new Error(`Tenant resolution failed: ${error.message}`);
  if (!data) {
    return { id: null, name: null, mode: "single" };
  }

  return mapOrganizationRow(data as OrganizationTenantRow);
}

function mapOrganizationRow(row: OrganizationTenantRow): TenantContext {
  return {
    id: row.id,
    name: row.name_ru,
    mode: row.tenant_mode === "multi" ? "multi" : "single",
  };
}
