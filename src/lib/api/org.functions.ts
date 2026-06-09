import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireModuleAccess } from "./_helpers";

/* ============ ORGANIZATION ============ */

export const getOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("organization")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const orgSchema = z.object({
  id: z.string().uuid(),
  name_ru: z.string().min(1).max(255),
  name_kk: z.string().min(1).max(255),
  short_name_ru: z.string().max(255).optional().default(""),
  short_name_kk: z.string().max(255).optional().default(""),
  bin: z.string().max(32).optional().default(""),
  legal_address_ru: z.string().max(1000).optional().default(""),
  legal_address_kk: z.string().max(1000).optional().default(""),
  phone: z.string().max(64).optional().default(""),
  email: z.string().max(255).optional().default(""),
  website: z.string().max(255).optional().default(""),
  head_user_id: z.string().uuid().nullable().optional(),
  logo_url: z.string().max(1000).optional().default(""),
  reg_number_prefix: z.string().max(32).optional().default("DOC"),
});

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(orgSchema)
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_org", { action: "write" });
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("organization")
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ POSITIONS ============ */

export const listPositions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("positions")
      .select("*, departments(id, name_ru, name_kk, code)")
      .order("level", { ascending: false })
      .order("code", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const positionSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  title_ru: z.string().min(1).max(255),
  title_kk: z.string().min(1).max(255),
  department_id: z.string().uuid().nullable().optional(),
  level: z.number().int().min(0).max(100).default(0),
  is_head: z.boolean().default(false),
});

export const upsertPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(positionSchema)
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_org", { action: "write" });
    if (data.id) {
      const { id, ...patch } = data;
      const { error } = await context.supabase.from("positions").update(patch as never).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { id: _omit, ...insert } = data;
    void _omit;
    const { data: row, error } = await context.supabase
      .from("positions")
      .insert(insert as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_org", { action: "write" });
    const { error } = await context.supabase.from("positions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ ROLE DEFINITIONS ============ */

export const listRoleDefinitions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("role_definitions")
      .select("*")
      .order("role", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ROLE = z.enum(["admin", "registrar", "approver", "signer", "archivist", "viewer"]);

const roleDefSchema = z.object({
  role: ROLE,
  title_ru: z.string().min(1).max(255),
  title_kk: z.string().min(1).max(255),
  description_ru: z.string().max(2000).optional().default(""),
  description_kk: z.string().max(2000).optional().default(""),
  permissions: z.record(z.string().min(1).max(64), z.boolean()),
});

export const updateRoleDefinition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(roleDefSchema)
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_roles", { action: "manage" });
    const { role, ...patch } = data;
    const { error } = await context.supabase
      .from("role_definitions")
      .update(patch as never)
      .eq("role", role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
