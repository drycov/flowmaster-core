import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function actorHasPlatformAccess(
  _supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(
    "user_has_permission" as never,
    {
      _user: userId,
      _permission: "manage_platform",
    } as never,
  );
  if (error) throw new Error(error.message);
  return !!data;
}

export async function resolveActorOrganizationId(
  supabase: SupabaseClient,
  userId: string,
  jwtOrganizationId?: string | null,
): Promise<string | null> {
  if (jwtOrganizationId) return jwtOrganizationId;

  const { data, error } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { organization_id?: string | null } | null)?.organization_id ?? null;
}

export async function fetchProfileOrganizationId(
  supabase: SupabaseClient,
  profileUserId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", profileUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Пользователь не найден");
  return (data as { organization_id?: string | null }).organization_id ?? null;
}

/** Ensures target user belongs to actor org unless actor has platform access. */
export async function assertUserManagedByActor(
  supabase: SupabaseClient,
  actorUserId: string,
  targetUserId: string,
  actorOrganizationId?: string | null,
): Promise<void> {
  if (actorUserId === targetUserId) return;

  if (await actorHasPlatformAccess(supabase, actorUserId)) return;

  const [actorOrg, targetOrg] = await Promise.all([
    resolveActorOrganizationId(supabase, actorUserId, actorOrganizationId),
    fetchProfileOrganizationId(supabase, targetUserId),
  ]);

  if (!actorOrg || !targetOrg || actorOrg !== targetOrg) {
    throw new Error("Нет доступа к пользователю другой организации");
  }
}

export type TenantListScope = {
  platformWide: boolean;
  organizationId: string | null;
};

export async function resolveTenantListScope(
  supabase: SupabaseClient,
  actorUserId: string,
  actorOrganizationId?: string | null,
): Promise<TenantListScope> {
  if (await actorHasPlatformAccess(supabase, actorUserId)) {
    return { platformWide: true, organizationId: null };
  }
  const organizationId = await resolveActorOrganizationId(
    supabase,
    actorUserId,
    actorOrganizationId,
  );
  if (!organizationId) {
    throw new Error("Организация пользователя не определена");
  }
  return { platformWide: false, organizationId };
}
