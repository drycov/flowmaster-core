import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getTenantBaseDomain, parseTenantSlugFromHost } from "./tenant-host.server";
import {
  isValidTenantSlug,
  normalizeTenantSlug,
  resolveOrganizationIdBySlug,
} from "./tenant-auth.server";

export type PublicTenantInfo = {
  slug: string;
  name_ru: string;
  name_kk: string;
} | null;

export type PublicTenantAuthContext = {
  multi_tenant: boolean;
  organization_count: number;
  resolved_tenant: PublicTenantInfo;
  require_tenant_slug: boolean;
  tenant_base_domain: string | null;
};

export async function buildPublicTenantAuthContext(
  hostHeader: string | null | undefined,
): Promise<PublicTenantAuthContext> {
  const baseDomain = getTenantBaseDomain();
  const hostSlug = parseTenantSlugFromHost(hostHeader, baseDomain);

  const { count: orgCount, error: countErr } = await supabaseAdmin
    .from("organization")
    .select("id", { count: "exact", head: true });
  if (countErr) throw new Error(countErr.message);

  const organizationCount = orgCount ?? 0;

  let resolvedTenant: PublicTenantInfo = null;
  if (hostSlug) {
    const { data, error } = await supabaseAdmin
      .from("organization")
      .select("slug, name_ru, name_kk, is_active")
      .eq("slug", hostSlug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data && (data as { is_active?: boolean }).is_active !== false) {
      resolvedTenant = {
        slug: (data as { slug: string }).slug,
        name_ru: (data as { name_ru: string }).name_ru,
        name_kk: (data as { name_kk: string }).name_kk,
      };
    }
  }

  const { data: modeRow } = await supabaseAdmin
    .from("organization")
    .select("tenant_mode")
    .limit(1)
    .maybeSingle();

  const multiTenant =
    organizationCount > 1 || (modeRow as { tenant_mode?: string } | null)?.tenant_mode === "multi";

  return {
    multi_tenant: multiTenant,
    organization_count: organizationCount,
    resolved_tenant: resolvedTenant,
    require_tenant_slug: multiTenant && !resolvedTenant,
    tenant_base_domain: baseDomain,
  };
}

export async function updateBootstrapOrganization(input: {
  slug: string;
  name_ru: string;
  name_kk: string;
}): Promise<void> {
  const slug = normalizeTenantSlug(input.slug);
  if (!isValidTenantSlug(slug)) {
    throw new Error("Код организации: только латиница, цифры и дефис (2–64 символа)");
  }

  const { data: org, error: orgErr } = await supabaseAdmin
    .from("organization")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  if (!org?.id) throw new Error("Организация не найдена");

  const { data: taken } = await supabaseAdmin
    .from("organization")
    .select("id")
    .eq("slug", slug)
    .neq("id", org.id)
    .maybeSingle();
  if (taken?.id) throw new Error("Код организации уже занят");

  const { error } = await supabaseAdmin
    .from("organization")
    .update({
      slug,
      name_ru: input.name_ru.trim(),
      name_kk: input.name_kk.trim(),
      short_name_ru: input.name_ru.trim(),
      short_name_kk: input.name_kk.trim(),
    } as never)
    .eq("id", org.id);
  if (error) throw new Error(error.message);
}

export async function fetchOrganizationIdForAuth(opts: {
  tenant_slug?: string | null;
  host_header?: string | null;
}): Promise<string | null> {
  const baseDomain = getTenantBaseDomain();
  const hostSlug = parseTenantSlugFromHost(opts.host_header, baseDomain);
  const slug = hostSlug || (opts.tenant_slug ? normalizeTenantSlug(opts.tenant_slug) : null);
  if (!slug) return null;
  return resolveOrganizationIdBySlug(slug);
}
