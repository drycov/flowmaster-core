import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AppRole } from "./constants";
import { resolveAuthMethod } from "./eds";

export type RegisterUserInput = {
  email: string;
  password: string;
  full_name_ru: string;
  full_name_kk: string;
  locale?: string;
  iin?: string | null;
  auth_method?: "email" | "eds" | "both";
};

export async function enableEmailLoginForUser(
  userId: string,
  email: string,
  password: string,
) {
  const normalized = email.toLowerCase().trim();

  const { data: current, error: loadErr } = await supabaseAdmin
    .from("profiles")
    .select("id, email, iin, password_hash")
    .eq("id", userId)
    .single();

  if (loadErr || !current) throw new Error("Профиль не найден");

  const { data: taken } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .neq("id", userId)
    .maybeSingle();

  if (taken?.id) throw new Error("Пользователь с таким email уже существует");

  const { error: pwdErr } = await supabaseAdmin.rpc("change_app_user_password" as never, {
    p_user_id: userId,
    p_new_password: password,
  } as never);
  if (pwdErr) throw new Error(pwdErr.message);

  const cur = current as { iin: string | null; password_hash: string | null };
  const { error: updErr } = await supabaseAdmin
    .from("profiles")
    .update({
      email: normalized,
      auth_method: resolveAuthMethod(true, !!cur.iin),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", userId);

  if (updErr) throw new Error(updErr.message);
}

/** Register via DB RPC (hash + role assignment in one transaction). */
export async function registerUser(input: RegisterUserInput): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("register_app_user" as never, {
    p_email: input.email,
    p_password: input.password,
    p_full_name_ru: input.full_name_ru,
    p_full_name_kk: input.full_name_kk,
    p_locale: input.locale ?? "ru",
    p_iin: input.iin ?? null,
    p_auth_method: input.auth_method ?? "email",
  } as never);

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Не удалось создать пользователя");
  return data as string;
}

/** Email/password login via DB RPC. */
export async function authenticateUser(email: string, password: string) {
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("auth_method, password_hash")
    .ilike("email", email.trim())
    .maybeSingle();

  if (existing?.auth_method === "eds" && !existing.password_hash) {
    throw new Error(
      "Для этого аккаунта не задан пароль. Войдите по ЭЦП или добавьте email и пароль в профиле.",
    );
  }

  const { data, error } = await supabaseAdmin.rpc("authenticate_app_user" as never, {
    p_email: email.trim(),
    p_password: password,
  } as never);

  if (error) {
    const msg = error.message;
    if (msg.includes("Неверный email") || msg.includes("password")) {
      throw new Error("Неверный email или пароль");
    }
    throw new Error(msg);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("Неверный email или пароль");
  }

  const userId = (row as { user_id?: string }).user_id;
  const userEmail = (row as { email?: string }).email;
  if (!userId || !userEmail) {
    throw new Error("Неверный email или пароль");
  }

  return { user_id: userId, email: userEmail };
}

export async function setUserRole(
  userId: string,
  role: AppRole,
  enabled: boolean,
): Promise<void> {
  if (enabled) {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role } as never, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", role);
  if (error) throw new Error(error.message);
}

export async function ensureAdminRole(userId: string, reason: string) {
  const roles = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("role", "admin" as never)
    .limit(1);

  if (roles.data?.length) return;

  const { error } = await supabaseAdmin.rpc("grant_app_role" as never, {
    _user: userId,
    _role: "admin",
    _reason: reason,
  } as never);
  if (error) throw new Error(error.message);
}
