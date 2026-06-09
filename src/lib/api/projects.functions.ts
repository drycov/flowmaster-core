import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { upsertRow } from "@/lib/api/db.helpers.server";
import { enforceModuleLicense, requireModuleAccess } from "./_helpers";

const PROJECT_SELECT = `
  *,
  departments(id, code, name_ru, name_kk),
  nomenclature_items(id, code, title_ru, title_kk),
  document_project_templates(
    id, template_id, label_ru, label_kk, sort_order, is_required, default_workflow_id,
    document_templates(id, name_ru, name_kk, category, default_workflow_id)
  )
`;

export const listDocumentProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        search: z.string().optional(),
        department_id: z.string().uuid().optional(),
        status: z.string().optional(),
        active_only: z.boolean().optional(),
      })
      .optional(),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("document_projects")
      .select(
        "id, code, name_ru, name_kk, status, is_active, department_id, nomenclature_id, created_at, departments(id, code, name_ru, name_kk), nomenclature_items(id, code, title_ru, title_kk)",
      )
      .order("code");

    if (data?.active_only !== false) q = q.eq("is_active", true);
    if (data?.department_id) q = q.eq("department_id", data.department_id);
    if (data?.status) q = q.eq("status", data.status);
    if (data?.search?.trim()) {
      q = q.or(
        `code.ilike.%${data.search.trim()}%,name_ru.ilike.%${data.search.trim()}%,name_kk.ilike.%${data.search.trim()}%`,
      );
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getDocumentProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("document_projects")
      .select(PROJECT_SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Project not found");
    return row;
  });

export const upsertDocumentProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      code: z.string().min(1).max(64),
      name_ru: z.string().min(1),
      name_kk: z.string().min(1),
      description_ru: z.string().optional(),
      description_kk: z.string().optional(),
      department_id: z.string().uuid().nullable().optional(),
      nomenclature_id: z.string().uuid().nullable().optional(),
      status: z.enum(["draft", "active", "completed", "archived"]).optional(),
      is_active: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "projects", { action: "manage" });

    const row = await upsertRow({
      supabase: context.supabase,
      table: "document_projects",
      row: {
        code: data.code.trim(),
        name_ru: data.name_ru,
        name_kk: data.name_kk,
        description_ru: data.description_ru ?? "",
        description_kk: data.description_kk ?? "",
        department_id: data.department_id ?? null,
        nomenclature_id: data.nomenclature_id ?? null,
        status: data.status ?? "active",
        is_active: data.is_active ?? true,
      },
      id: data.id,
      insertOnly: { owner_id: context.userId },
    });
    return { id: String(row.id) };
  });

export const upsertProjectTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      project_id: z.string().uuid(),
      template_id: z.string().uuid(),
      label_ru: z.string().optional(),
      label_kk: z.string().optional(),
      sort_order: z.number().int().optional(),
      is_required: z.boolean().optional(),
      default_workflow_id: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "projects", { action: "manage" });
    await enforceModuleLicense(context.supabase, "templates", "write");

    const payload = {
      project_id: data.project_id,
      template_id: data.template_id,
      label_ru: data.label_ru ?? "",
      label_kk: data.label_kk ?? "",
      sort_order: data.sort_order ?? 0,
      is_required: data.is_required ?? false,
      default_workflow_id: data.default_workflow_id ?? null,
    };

    const row = await upsertRow({
      supabase: context.supabase,
      table: "document_project_templates",
      row: payload,
      id: data.id,
    });
    return { id: String(row.id) };
  });

export const deleteProjectTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "projects", { action: "manage" });
    const { error } = await context.supabase
      .from("document_project_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProjectDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ project_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("documents")
      .select("id, reg_number, title_ru, title_kk, status, template_id, created_at")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
