import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "./_helpers";

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("document_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("document_templates")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const fieldSchema = z.object({
  key: z.string().min(1).max(64),
  label_ru: z.string().min(1),
  label_kk: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "date", "select", "user"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

export const upsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      name_ru: z.string().min(1),
      name_kk: z.string().min(1),
      category: z.string().default("general"),
      description: z.string().nullable().optional(),
      status: z.enum(["draft", "published", "archived"]).default("draft"),
      schema: z.object({ fields: z.array(fieldSchema), body_template: z.string().optional() }),
      default_workflow_id: z.string().uuid().nullable().optional(),
      allow_custom_route: z.boolean().default(true),
    }),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase, context.userId, "manage_templates");
    const { supabase, userId } = context;
    const payload = {
      name_ru: data.name_ru,
      name_kk: data.name_kk,
      category: data.category,
      description: data.description ?? null,
      status: data.status,
      schema: data.schema,
      default_workflow_id: data.default_workflow_id ?? null,
      allow_custom_route: data.allow_custom_route,
    };
    if (data.id) {
      const { error } = await (supabase.from("document_templates") as any)
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await (supabase.from("document_templates") as any)
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// Generate document body by simple {{key}} substitution
export const generateFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      template_id: z.string().uuid(),
      values: z.record(z.string(), z.string()),
      title_ru: z.string().min(1),
      title_kk: z.string().optional().nullable(),
      nomenclature_id: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tpl = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", data.template_id)
      .single();
    if (tpl.error) throw new Error(tpl.error.message);
    const schema = (tpl.data.schema as { body_template?: string }) || {};
    let body = schema.body_template || "";
    for (const [k, v] of Object.entries(data.values)) {
      body = body.replaceAll(`{{${k}}}`, String(v));
    }
    const { data: doc, error } = await (supabase.from("documents") as any)
      .insert({
        title_ru: data.title_ru,
        title_kk: data.title_kk ?? data.title_ru,
        body,
        template_id: data.template_id,
        nomenclature_id: data.nomenclature_id ?? null,
        created_by: userId,
        reg_number: "",
        workflow_id: (tpl.data as any).default_workflow_id ?? null,
      })
      .select("id, reg_number")
      .single();
    if (error) throw new Error(error.message);
    return doc;
  });
