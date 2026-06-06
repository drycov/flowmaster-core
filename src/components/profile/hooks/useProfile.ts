// src/components/profile/hooks/useProfile.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UserProfile } from "../types";

async function fetchProfile(): Promise<UserProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User not found");

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error) throw error;
  const profile = data as any;

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  return {
    id: user.id,
    email: user.email!,
    full_name_ru: profile.full_name_ru,
    full_name_kk: profile.full_name_kk,
    avatar_url: profile.avatar_url ?? null,
    roles: (rolesData ?? []).map((r) => r.role),
    created_at: profile.created_at || user.created_at,
    updated_at: profile.updated_at,
    last_sign_in_at: user.last_sign_in_at,
    department: profile.department_id ?? null,
    position: profile.position_id ?? null,
    phone: profile.phone ?? null,
  };
}

export function useProfile() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    staleTime: 5 * 60 * 1000,
  });

  return { profile: data, isLoading, error, refetch };
}
