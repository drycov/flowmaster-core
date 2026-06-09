import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getTenantBaseDomain, parseTenantSlugFromHost } from "./tenant-host.server";

export function normalizeTenantSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function isValidTenantSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug);
}

export async function resolveOrganizationIdBySlug(
  slug: string | null | undefined,
): Promise<string | null> {
  const normalized = slug ? normalizeTenantSlug(slug) : "";
  if (!normalized || !isValidTenantSlug(normalized)) return null;

  const { data, error } = await supabaseAdmin
    .from("organization")
    .select("id, is_active")
    .eq("slug", normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  if ((data as { is_active?: boolean }).is_active === false) {
    throw new Error("Организация отключена");
  }
  return (data as { id: string }).id;
}

export async function assertUserBelongsToOrganization(
  userId: string,
  organizationId: string | null,
): Promise<void> {
  if (!organizationId) return;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Профиль пользователя не найден");

  const profileOrg = (data as { organization_id?: string | null }).organization_id;
  if (profileOrg && profileOrg !== organizationId) {
    throw new Error("Учётная запись не принадлежит этой организации");
  }
}

export async function resolveLoginOrganizationId(opts: {
  tenantSlug?: string | null;
  hostSlug?: string | null;
}): Promise<string | null> {
  const slug = opts.hostSlug || opts.tenantSlug || null;
  if (!slug) {
    const { count } = await supabaseAdmin
      .from("organization")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) <= 1) return null;
    throw new Error("Укажите код организации для входа");
  }
  return resolveOrganizationIdBySlug(slug);
}

/** Resolve target organization for unauthenticated auth endpoints (email/LDAP/EDS/Telegram). */
export async function resolveAuthOrganizationFromRequest(opts: {
  tenantSlug?: string | null;
  hostHeader?: string | null;
}): Promise<string | null> {
  const hostSlug = parseTenantSlugFromHost(opts.hostHeader, getTenantBaseDomain());
  return resolveLoginOrganizationId({
    tenantSlug: opts.tenantSlug ?? null,
    hostSlug,
  });
}
