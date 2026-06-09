import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireModuleAccess } from "./_helpers";

type ProfileBrief = {
  id: string;
  full_name_ru: string;
  full_name_kk: string;
  email: string;
};

async function loadProfiles(
  supabase: { from: (table: string) => { select: (cols: string) => { in: (col: string, ids: string[]) => PromiseLike<{ data: ProfileBrief[] | null; error: { message: string } | null }> } } },
  ids: string[],
): Promise<Map<string, ProfileBrief>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name_ru, full_name_kk, email")
    .in("id", unique);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((p) => [p.id, p]));
}

export const listMySubstitutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const [asPrincipal, asSubstitute] = await Promise.all([
      supabase
        .from("user_substitutions")
        .select("id, principal_id, substitute_id, valid_from, valid_until, note, is_active, created_at")
        .eq("principal_id", userId)
        .order("valid_from", { ascending: false }),
      supabase
        .from("user_substitutions")
        .select("id, principal_id, valid_from, valid_until, note, is_active")
        .eq("substitute_id", userId)
        .eq("is_active", true)
        .lte("valid_from", now)
        .gte("valid_until", now),
    ]);

    if (asPrincipal.error) throw new Error(asPrincipal.error.message);
    if (asSubstitute.error) throw new Error(asSubstitute.error.message);

    const principalRecords = asPrincipal.data ?? [];
    const substituteRecords = asSubstitute.data ?? [];

    const profileIds = [
      ...principalRecords.map((r) => r.substitute_id as string),
      ...substituteRecords.map((r) => r.principal_id as string),
    ];
    const profiles = await loadProfiles(supabase, profileIds);

    const records = principalRecords.map((row) => ({
      ...row,
      substitute: profiles.get(row.substitute_id as string) ?? null,
    }));

    const actingForDetails = substituteRecords.map((row) => ({
      ...row,
      principal: profiles.get(row.principal_id as string) ?? null,
    }));

    return {
      records,
      actingFor: actingForDetails.map((r) => r.principal_id as string),
      actingForDetails,
    };
  });

export const listOrgSubstitutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireModuleAccess(supabase, userId, "substitutions", { action: "manage" });

    const { data, error } = await supabase
      .from("user_substitutions")
      .select("id, principal_id, substitute_id, valid_from, valid_until, note, is_active, created_at")
      .eq("is_active", true)
      .order("valid_from", { ascending: false });

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const profileIds = rows.flatMap((r) => [r.principal_id as string, r.substitute_id as string]);
    const profiles = await loadProfiles(supabase, profileIds);

    return rows.map((row) => ({
      ...row,
      principal: profiles.get(row.principal_id as string) ?? null,
      substitute: profiles.get(row.substitute_id as string) ?? null,
    }));
  });

export const createSubstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      substitute_id: z.string().uuid(),
      valid_from: z.string(),
      valid_until: z.string(),
      note: z.string().max(500).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "substitutions", { action: "write" });
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("user_substitutions")
      .insert({
        principal_id: userId,
        substitute_id: data.substitute_id,
        valid_from: data.valid_from,
        valid_until: data.valid_until,
        note: data.note ?? null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const deactivateSubstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "substitutions", { action: "write" });
    const { error } = await context.supabase
      .from("user_substitutions")
      .update({ is_active: false })
      .eq("id", data.id)
      .eq("principal_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
