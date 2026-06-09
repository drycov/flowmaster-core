import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { getMyProfile, getUserProfile } from "@/lib/api/admin.functions";
import type { UserProfile } from "../types";

function toUserProfile(profile: Record<string, unknown>, roles: string[]): UserProfile {
  return {
    id: profile.id as string,
    email: (profile.email as string | null | undefined) ?? "",
    full_name_ru: (profile.full_name_ru as string) ?? null,
    full_name_kk: (profile.full_name_kk as string) ?? null,
    avatar_url: (profile.avatar_url as string | null) ?? null,
    roles,
    created_at: (profile.created_at as string) ?? new Date().toISOString(),
    updated_at: (profile.updated_at as string) ?? new Date().toISOString(),
    last_sign_in_at: undefined,
    department: (profile.department_label as string | null) ?? null,
    position: (profile.position_label as string | null) ?? null,
    phone: (profile.phone as string | null) ?? null,
    auth_method: (profile.auth_method as UserProfile["auth_method"]) ?? "email",
    iin: (profile.iin as string | null) ?? null,
    has_password: !!(profile.has_password as boolean | undefined),
    has_eds: !!(profile.has_eds as boolean | undefined),
    access_level_id: (profile.access_level_id as string | null | undefined) ?? null,
  };
}

async function loadProfile(
  viewUserId: string | undefined,
  t: (key: string) => string,
): Promise<UserProfile> {
  if (!viewUserId) {
    const me = await getMyProfile();
    const profile = me.profile as Record<string, unknown> | null;
    if (!profile) throw new Error(t("profile.notFoundError"));
    return toUserProfile(profile, me.roles ?? []);
  }

  const result = await getUserProfile({ data: { user_id: viewUserId } });
  return toUserProfile(result.profile as Record<string, unknown>, result.roles);
}

export function useProfile(viewUserId?: string) {
  const { t } = useI18n();
  const isOwnProfile = !viewUserId;

  const query = useQuery({
    queryKey: ["user-profile", viewUserId ?? "me"],
    queryFn: () => loadProfile(viewUserId, t),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isOwnProfile,
  };
}
