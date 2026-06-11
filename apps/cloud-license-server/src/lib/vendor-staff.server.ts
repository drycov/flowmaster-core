import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortalUser } from "./portal-auth.js";
import {
  getVendorAdminAllowlist,
  getVendorTelegramChatByEmail,
  getTelegramBotToken,
} from "./vendor-admin-config.js";

export type VendorStaffRole = "owner" | "admin" | "staff";
export type VendorStaffStatus = "active" | "disabled";

export type VendorStaffRow = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  role: VendorStaffRole;
  telegram_chat_id: string;
  status: VendorStaffStatus;
  created_by: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorStaffPublic = Pick<
  VendorStaffRow,
  "id" | "email" | "full_name" | "role" | "telegram_chat_id" | "status" | "last_login_at" | "created_at"
>;

export type VendorAdminIdentity = PortalUser & { staff: VendorStaffRow };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapRow(row: Record<string, unknown>): VendorStaffRow {
  return row as unknown as VendorStaffRow;
}

export async function countActiveVendorStaff(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("vendor_staff")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function isVendorAdminUiConfigured(supabase: SupabaseClient): Promise<boolean> {
  if ((await countActiveVendorStaff(supabase)) > 0) return true;
  if (getVendorTelegramChatByEmail().size > 0 && getTelegramBotToken()) return true;
  return getVendorAdminAllowlist().size > 0;
}

export async function findVendorStaffByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<VendorStaffRow | null> {
  const { data, error } = await supabase
    .from("vendor_staff")
    .select("*")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function findVendorStaffByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<VendorStaffRow | null> {
  const { data, error } = await supabase
    .from("vendor_staff")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function getTelegramChatIdForStaff(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const staff = await findVendorStaffByEmail(supabase, email);
  if (staff?.telegram_chat_id?.trim()) return staff.telegram_chat_id.trim();
  return getVendorTelegramChatByEmail().get(normalizeEmail(email)) ?? null;
}

export async function hasAnyStaffTelegramLinked(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from("vendor_staff")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .neq("telegram_chat_id", "");
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) return true;
  return getVendorTelegramChatByEmail().size > 0;
}

async function insertStaff(
  supabase: SupabaseClient,
  row: {
    user_id?: string | null;
    email: string;
    full_name?: string;
    role?: VendorStaffRole;
    telegram_chat_id?: string;
    created_by?: string | null;
  },
): Promise<VendorStaffRow> {
  const email = normalizeEmail(row.email);
  const envChat = getVendorTelegramChatByEmail().get(email) ?? "";

  const { data, error } = await supabase
    .from("vendor_staff")
    .insert({
      user_id: row.user_id ?? null,
      email,
      full_name: row.full_name?.trim() || email,
      role: row.role ?? "staff",
      telegram_chat_id: row.telegram_chat_id?.trim() || envChat,
      status: "active",
      created_by: row.created_by ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

async function bootstrapStaffFromAllowlist(
  supabase: SupabaseClient,
  user: PortalUser,
): Promise<VendorStaffRow | null> {
  const email = normalizeEmail(user.email);
  if (!getVendorAdminAllowlist().has(email)) return null;

  const existing = await findVendorStaffByEmail(supabase, email);
  if (existing) return existing;

  const total = await countActiveVendorStaff(supabase);
  const role: VendorStaffRole = total === 0 ? "owner" : "staff";

  return insertStaff(supabase, {
    user_id: user.id,
    email,
    role,
    full_name: email.split("@")[0] ?? email,
  });
}

export async function resolveVendorAdminIdentity(
  supabase: SupabaseClient,
  authorization: string | undefined,
  getUser: (auth: string | undefined) => Promise<PortalUser | null>,
): Promise<VendorAdminIdentity | null> {
  const user = await getUser(authorization);
  if (!user) return null;

  let staff =
    (await findVendorStaffByUserId(supabase, user.id)) ??
    (await findVendorStaffByEmail(supabase, user.email));

  if (!staff) {
    staff = await bootstrapStaffFromAllowlist(supabase, user);
  }

  if (!staff || staff.status !== "active") return null;

  const patch: Record<string, unknown> = { last_login_at: new Date().toISOString() };
  if (!staff.user_id) patch.user_id = user.id;

  const { data: updated, error } = await supabase
    .from("vendor_staff")
    .update(patch)
    .eq("id", staff.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return { ...user, staff: mapRow(updated as Record<string, unknown>) };
}

export async function listVendorStaff(supabase: SupabaseClient): Promise<VendorStaffPublic[]> {
  const { data, error } = await supabase
    .from("vendor_staff")
    .select("id, email, full_name, role, telegram_chat_id, status, last_login_at, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as VendorStaffPublic[];
}

export async function createVendorStaffUser(
  supabase: SupabaseClient,
  actorStaffId: string,
  input: {
    email: string;
    password: string;
    full_name?: string;
    role?: VendorStaffRole;
    telegram_chat_id?: string;
  },
): Promise<VendorStaffPublic> {
  const email = normalizeEmail(input.email);
  if (input.password.length < 8) {
    throw new Error("Пароль не короче 8 символов");
  }

  const existing = await findVendorStaffByEmail(supabase, email);
  if (existing) throw new Error("Сотрудник с таким email уже существует");

  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { vendor_staff: true, full_name: input.full_name?.trim() || email },
  });

  if (authErr) throw new Error(authErr.message);

  const staff = await insertStaff(supabase, {
    user_id: authUser.user.id,
    email,
    full_name: input.full_name,
    role: input.role ?? "staff",
    telegram_chat_id: input.telegram_chat_id,
    created_by: actorStaffId,
  });

  return {
    id: staff.id,
    email: staff.email,
    full_name: staff.full_name,
    role: staff.role,
    telegram_chat_id: staff.telegram_chat_id,
    status: staff.status,
    last_login_at: staff.last_login_at,
    created_at: staff.created_at,
  };
}

export async function bootstrapFirstOwner(
  supabase: SupabaseClient,
  input: {
    email: string;
    password: string;
    full_name?: string;
    telegram_chat_id?: string;
  },
): Promise<VendorStaffPublic> {
  const total = await countActiveVendorStaff(supabase);
  if (total > 0) throw new Error("vendor_staff уже содержит записи — bootstrap недоступен");

  const email = normalizeEmail(input.email);
  const existingStaff = await findVendorStaffByEmail(supabase, email);
  if (existingStaff) throw new Error("Сотрудник уже существует");

  let userId: string;
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { vendor_staff: true, role: "owner" },
  });

  if (authErr) {
    const msg = authErr.message.toLowerCase();
    if (!msg.includes("already") && !msg.includes("registered") && !msg.includes("exists")) {
      throw new Error(authErr.message);
    }
    const existingId = await findAuthUserIdByEmail(supabase, email);
    if (!existingId) throw new Error(authErr.message);
    const { error: updErr } = await supabase.auth.admin.updateUserById(existingId, {
      password: input.password,
      email_confirm: true,
    });
    if (updErr) throw new Error(updErr.message);
    userId = existingId;
  } else {
    userId = authUser.user.id;
  }

  const staff = await insertStaff(supabase, {
    user_id: userId,
    email,
    full_name: input.full_name,
    role: "owner",
    telegram_chat_id: input.telegram_chat_id,
    created_by: null,
  });

  return {
    id: staff.id,
    email: staff.email,
    full_name: staff.full_name,
    role: staff.role,
    telegram_chat_id: staff.telegram_chat_id,
    status: staff.status,
    last_login_at: staff.last_login_at,
    created_at: staff.created_at,
  };
}

async function findAuthUserIdByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function updateVendorStaff(
  supabase: SupabaseClient,
  staffId: string,
  patch: {
    full_name?: string;
    role?: VendorStaffRole;
    telegram_chat_id?: string;
    status?: VendorStaffStatus;
  },
): Promise<VendorStaffPublic> {
  const { data, error } = await supabase
    .from("vendor_staff")
    .update({
      ...(patch.full_name !== undefined ? { full_name: patch.full_name.trim() } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.telegram_chat_id !== undefined
        ? { telegram_chat_id: patch.telegram_chat_id.trim() }
        : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    })
    .eq("id", staffId)
    .select("id, email, full_name, role, telegram_chat_id, status, last_login_at, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as VendorStaffPublic;
}

export function canManageVendorStaff(role: VendorStaffRole): boolean {
  return role === "owner" || role === "admin";
}
