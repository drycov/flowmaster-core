import type { SupabaseClient } from "@supabase/supabase-js";

export async function requirePermission(
  supabase: SupabaseClient,
  userId: string,
  permission: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("user_has_permission" as never, {
    _user: userId,
    _permission: permission,
  } as never);
  if (error) throw new Error(`Permission check failed: ${error.message}`);
  if (!data) throw new Error(`Forbidden: missing permission "${permission}"`);
}

export async function requireAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}
