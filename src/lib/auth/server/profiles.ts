import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fixUtf8Mojibake } from "@/lib/iin-parser";
import { PROFILE_SELECT } from "./constants";

export type ProfileRow = {
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  departments?: { name_ru?: string | null; name_kk?: string | null } | null;
  positions?: { title_ru?: string | null; title_kk?: string | null } | null;
  [key: string]: unknown;
};

export function normalizeProfileNames<T extends { full_name_ru?: string | null; full_name_kk?: string | null }>(
  profile: T,
): T {
  return {
    ...profile,
    full_name_ru: profile.full_name_ru ? fixUtf8Mojibake(profile.full_name_ru) : profile.full_name_ru,
    full_name_kk: profile.full_name_kk ? fixUtf8Mojibake(profile.full_name_kk) : profile.full_name_kk,
  };
}

export function mapProfileRow(profile: ProfileRow, roles: string[]) {
  const dept = profile.departments;
  const pos = profile.positions;
  const normalized = normalizeProfileNames(profile);
  const { password_hash, ...safe } = normalized;

  return {
    profile: {
      ...safe,
      auth_method: (safe.auth_method as string | undefined) ?? "email",
      iin: (safe.iin as string | null | undefined) ?? null,
      has_password: !!password_hash,
      has_eds: !!(safe.iin as string | null | undefined),
      department_label: dept ? `${dept.name_ru ?? ""} / ${dept.name_kk ?? ""}`.trim() : null,
      position_label: pos ? `${pos.title_ru ?? ""} / ${pos.title_kk ?? ""}`.trim() : null,
    },
    roles,
  };
}

export async function fetchProfileById(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ProfileRow | null;
}

export async function fetchUserRoles(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.role as string);
}
