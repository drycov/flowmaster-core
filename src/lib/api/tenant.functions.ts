import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registerUser, setUserRole as setUserRoleDb } from "@/lib/auth/server";
import { validatePassword } from "@/lib/auth/policy";
import { requireAvailableSeat, requireModuleAccess } from "@/lib/api/_helpers";
import { isValidTenantSlug, normalizeTenantSlug } from "@/lib/access/tenant-auth.server";
import {
  buildPublicTenantAuthContext,
  type PublicTenantAuthContext,
} from "@/lib/access/tenant-public.server";
import {
  resolveTenantFromOrganization,
  resolveTenantFromOrganizationId,
} from "@/lib/access/tenant.server";
import type { TenantContext } from "@/lib/access/tenant";

export type TenantListItem = {
  id: string;
  slug: string | null;
  name_ru: string;
  name_kk: string;
  tenant_mode: string;
  is_active: boolean;
  max_users: number | null;
  created_at: string;
  user_count: number;
};

export const getPublicTenantAuthContext = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicTenantAuthContext> => {
    const request = getRequest();
    const host = request?.headers?.get("host") ?? null;
    return buildPublicTenantAuthContext(host);
  },
);

export const getTenantContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TenantContext> => {
    if (context.organizationId) {
      return resolveTenantFromOrganizationId(supabaseAdmin, context.organizationId);
    }
    return resolveTenantFromOrganization(context.supabase);
  });

export const resolveTenantBySlug = createServerFn({ method: "POST" })
  .inputValidator(z.object({ slug: z.string().min(1).max(64) }))
  .handler(async ({ data }): Promise<TenantContext | null> => {
    const slug = normalizeTenantSlug(data.slug);
    const { data: row, error } = await supabaseAdmin
      .from("organization")
      .select("id, slug, name_ru, tenant_mode, is_active")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row || (row as { is_active?: boolean }).is_active === false) return null;

    const org = row as {
      id: string;
      slug: string | null;
      name_ru: string | null;
      tenant_mode: string | null;
    };

    return {
      id: org.id,
      name: org.name_ru,
      mode: org.tenant_mode === "multi" ? "multi" : "single",
    };
  });

export const listTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TenantListItem[]> => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_platform", {
      action: "manage",
    });

    const { data: orgs, error } = await supabaseAdmin
      .from("organization")
      .select("id, slug, name_ru, name_kk, tenant_mode, is_active, max_users, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("organization_id");
    if (profErr) throw new Error(profErr.message);

    const counts = new Map<string, number>();
    for (const p of profiles ?? []) {
      const oid = (p as { organization_id?: string | null }).organization_id;
      if (!oid) continue;
      counts.set(oid, (counts.get(oid) ?? 0) + 1);
    }

    return (orgs ?? []).map((o) => ({
      ...(o as TenantListItem),
      user_count: counts.get((o as { id: string }).id) ?? 0,
    }));
  });

export const provisionTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      slug: z.string().min(2).max(64),
      name_ru: z.string().min(1).max(255),
      name_kk: z.string().min(1).max(255),
      admin_email: z.string().email(),
      admin_password: z.string().min(8),
      admin_full_name_ru: z.string().min(1),
      admin_full_name_kk: z.string().min(1),
      max_users: z.number().int().positive().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_platform", {
      action: "manage",
    });
    await requireAvailableSeat(supabaseAdmin);

    const slug = normalizeTenantSlug(data.slug);
    if (!isValidTenantSlug(slug)) {
      throw new Error("Код организации: латиница, цифры и дефис (2–64 символа)");
    }

    const { data: taken } = await supabaseAdmin
      .from("organization")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (taken?.id) throw new Error("Код организации уже занят");

    const pwdErr = validatePassword(data.admin_password, {
      min_password_length: 8,
      require_strong_password: false,
      allow_public_signup: true,
      allow_eds_signup: true,
      session_ttl_hours: 168,
      allowed_email_domains: [],
    });
    if (pwdErr) throw new Error(pwdErr);

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organization")
      .insert({
        slug,
        name_ru: data.name_ru.trim(),
        name_kk: data.name_kk.trim(),
        short_name_ru: data.name_ru.trim(),
        short_name_kk: data.name_kk.trim(),
        tenant_mode: "multi",
        max_users: data.max_users ?? null,
      } as never)
      .select("id, slug")
      .single();
    if (orgErr) throw new Error(orgErr.message);

    const orgId = (org as { id: string }).id;

    const userId = await registerUser({
      email: data.admin_email,
      password: data.admin_password,
      full_name_ru: data.admin_full_name_ru,
      full_name_kk: data.admin_full_name_kk,
      organization_id: orgId,
    });

    await setUserRoleDb(userId, "admin", true);

    return {
      organization_id: orgId,
      slug: (org as { slug: string }).slug,
      admin_user_id: userId,
    };
  });

export const setTenantActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organization_id: z.string().uuid(),
      is_active: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_platform", {
      action: "manage",
    });

    if (!data.is_active) {
      const { count, error: countErr } = await supabaseAdmin
        .from("organization")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (countErr) throw new Error(countErr.message);
      if ((count ?? 0) <= 1) {
        throw new Error("Нельзя отключить последнюю активную организацию");
      }
    }

    const { data: org, error: loadErr } = await supabaseAdmin
      .from("organization")
      .select("id, is_active")
      .eq("id", data.organization_id)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!org?.id) throw new Error("Организация не найдена");

    const { error } = await supabaseAdmin
      .from("organization")
      .update({ is_active: data.is_active } as never)
      .eq("id", data.organization_id);
    if (error) throw new Error(error.message);

    return { ok: true, is_active: data.is_active };
  });

export const updateTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organization_id: z.string().uuid(),
      slug: z.string().min(2).max(64).optional(),
      name_ru: z.string().min(1).max(255).optional(),
      name_kk: z.string().min(1).max(255).optional(),
      max_users: z.number().int().positive().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_platform", {
      action: "manage",
    });

    const { data: org, error: loadErr } = await supabaseAdmin
      .from("organization")
      .select("id, slug")
      .eq("id", data.organization_id)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!org?.id) throw new Error("Организация не найдена");

    const patch: Record<string, string | number | null> = {};

    if (data.name_ru !== undefined) {
      const nameRu = data.name_ru.trim();
      patch.name_ru = nameRu;
      patch.short_name_ru = nameRu;
    }
    if (data.name_kk !== undefined) {
      const nameKk = data.name_kk.trim();
      patch.name_kk = nameKk;
      patch.short_name_kk = nameKk;
    }

    if (data.slug !== undefined) {
      const slug = normalizeTenantSlug(data.slug);
      if (!isValidTenantSlug(slug)) {
        throw new Error("Код организации: латиница, цифры и дефис (2–64 символа)");
      }
      const { data: taken } = await supabaseAdmin
        .from("organization")
        .select("id")
        .eq("slug", slug)
        .neq("id", org.id)
        .maybeSingle();
      if (taken?.id) throw new Error("Код организации уже занят");
      patch.slug = slug;
    }

    if (data.max_users !== undefined) {
      if (data.max_users !== null && data.max_users < 1) {
        throw new Error("Лимит пользователей должен быть положительным числом");
      }
      patch.max_users = data.max_users;
    }

    if (Object.keys(patch).length === 0) {
      return { ok: true };
    }

    const { error } = await supabaseAdmin
      .from("organization")
      .update(patch as never)
      .eq("id", org.id);
    if (error) throw new Error(error.message);

    return { ok: true, slug: patch.slug ?? (org as { slug?: string }).slug };
  });
