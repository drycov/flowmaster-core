import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertUserManagedByActor } from "@/lib/access/tenant-admin.server";
import {
  fetchProfileById,
  fetchUserRoles,
  mapProfileRow,
} from "@/lib/auth/server";
import type { Permission } from "@/lib/access/permissions";
import { fetchUserPermissions, requireModuleAccess } from "../_helpers";
import { buildTemplateAuthorDefaultsForUser } from "@/lib/templates/author-defaults.server";

export type MyProfileResponse = {
  profile: ReturnType<typeof mapProfileRow>["profile"];
  roles: string[];
  permissions: Partial<Record<Permission, boolean>>;
  template_defaults: Record<string, string>;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfileResponse> => {
    const { userId } = context;

    const profileData = await fetchProfileById(userId);
    if (!profileData) throw new Error("Профиль пользователя не найден");

    const userRoles = await fetchUserRoles(userId);
    const permissions = await fetchUserPermissions(supabaseAdmin, userId);

    const mapped = mapProfileRow(profileData, userRoles);
    const template_defaults = await buildTemplateAuthorDefaultsForUser(userId);

    return {
      profile: mapped.profile,
      roles: mapped.roles,
      permissions,
      template_defaults,
    };
  });

export const getUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const isSelf = data.user_id === context.userId;
    if (!isSelf) {
      await requireModuleAccess(supabaseAdmin, context.userId, "admin_users", { action: "read" });
      await assertUserManagedByActor(
        supabaseAdmin,
        context.userId,
        data.user_id,
        context.organizationId,
      );
    }

    const profileData = await fetchProfileById(data.user_id);
    if (!profileData) throw new Error("Профиль пользователя не найден");

    const userRoles = await fetchUserRoles(data.user_id);
    return mapProfileRow(profileData, userRoles);
  });
