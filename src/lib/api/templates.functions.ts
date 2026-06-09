import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enforceLicense, requirePermission } from "./_helpers";
import { customRouteSchema } from "@/lib/workflow/custom-route-schema";
import { STORAGE_BUCKETS, documentVersionPath } from "@/lib/storage/buckets";
import {
  mergeTemplateFieldKeys,
  supportsTemplateProcessing,
  templateMimeType,
  type TemplateFieldDef,
  type TemplateFileFormat,
} from "@/lib/templates/file-formats";
import {
  isDefaultTemplateName,
} from "@/lib/templates/field-inference";
import { extractTemplateFileContext } from "@/lib/templates/file-context.server";
import {
  downloadTemplateBuffer,
  renderTemplateFile,
  scanTemplatePlaceholders,
} from "@/lib/templates/file-processing.server";
import { buildTemplateAuthorDefaultsForUser } from "@/lib/templates/author-defaults.server";
import { resolveDocumentTitles } from "@/lib/templates/document-title";
import { ensureDocumentRegNumber } from "@/lib/documents/registration.server";
import { resolveDocumentReferences } from "@/lib/documents/reference-fields.server";

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
    await enforceLicense(context.supabase, { writable: true, feature: "templates" });
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

function substituteTemplateBody(
  template: string,
  values: Record<string, string>,
): string {
  let body = template;
  for (const [k, v] of Object.entries(values)) {
    body = body.replaceAll(`{{${k}}}`, String(v));
  }
  return body;
}

function buildSystemTemplateValues(data: {
  title_ru: string;
  title_kk?: string | null;
  reg_number?: string;
}): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10);
  const vals: Record<string, string> = {
    document_title: data.title_ru,
    title_ru: data.title_ru,
    title_kk: data.title_kk ?? data.title_ru,
    document_date: today,
  };
  if (data.reg_number) {
    vals.registration_number = data.reg_number;
    vals.reg_number = data.reg_number;
  }
  return vals;
}

/** Extract {{placeholder}} keys from uploaded DOCX/XLSX template file. */
export const scanTemplateFilePlaceholders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ template_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase, context.userId, "manage_templates");
    await enforceLicense(context.supabase, { writable: true, feature: "templates" });

    const { data: tpl, error } = await context.supabase
      .from("document_templates")
      .select("file_path, file_format")
      .eq("id", data.template_id)
      .single();

    if (error || !tpl) throw new Error("Шаблон не найден");

    const row = tpl as { file_path?: string | null; file_format?: string | null };
    if (!row.file_path) throw new Error("Файл шаблона не загружен");

    const format = row.file_format as TemplateFileFormat | null;
    if (!format || !supportsTemplateProcessing(format)) {
      throw new Error(
        "Извлечение полей поддерживается только для DOCX и XLSX. Загрузите файл в современном формате.",
      );
    }

    const buffer = await downloadTemplateBuffer(row.file_path);
    const keys = await scanTemplatePlaceholders(buffer, format);
    return { keys, file_format: format };
  });

/** Parse DOCX/XLSX file and merge {{fields}} into template schema (persisted). */
export const syncTemplateFieldsFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ template_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase, context.userId, "manage_templates");
    await enforceLicense(context.supabase, { writable: true, feature: "templates" });

    const { data: tpl, error } = await context.supabase
      .from("document_templates")
      .select("name_ru, name_kk, description, category, schema, file_path, file_format")
      .eq("id", data.template_id)
      .single();

    if (error || !tpl) throw new Error("Шаблон не найден");

    const row = tpl as {
      name_ru?: string;
      name_kk?: string;
      description?: string | null;
      category?: string;
      schema?: { fields?: TemplateFieldDef[]; body_template?: string };
      file_path?: string | null;
      file_format?: string | null;
    };

    if (!row.file_path) throw new Error("Файл шаблона не загружен");

    const format = row.file_format as TemplateFileFormat | null;
    if (!format || !supportsTemplateProcessing(format)) {
      throw new Error(
        "Извлечение полей поддерживается только для DOCX и XLSX. Загрузите файл в современном формате.",
      );
    }

    const buffer = await downloadTemplateBuffer(row.file_path);
    const [keys, fileContext] = await Promise.all([
      scanTemplatePlaceholders(buffer, format),
      extractTemplateFileContext(buffer, format, row.file_path),
    ]);

    const existing = row.schema?.fields ?? [];
    const existingKeys = new Set(existing.map((f) => f.key));
    const fields = mergeTemplateFieldKeys(existing, keys);
    const added = keys.filter((k) => !existingKeys.has(k)).length;

    const schema = {
      ...(row.schema ?? {}),
      fields,
    };

    const metadata: {
      name_ru?: string;
      name_kk?: string;
      description?: string | null;
      category?: string;
    } = {};

    if (isDefaultTemplateName(row.name_ru)) {
      metadata.name_ru = fileContext.title;
    }
    if (isDefaultTemplateName(row.name_kk) || !row.name_kk?.trim() || row.name_kk === row.name_ru) {
      metadata.name_kk = metadata.name_ru ?? fileContext.title;
    }
    if (!row.description?.trim()) {
      metadata.description = fileContext.description;
    }
    if ((!row.category || row.category === "general") && fileContext.category) {
      metadata.category = fileContext.category;
    }

    const { error: updErr } = await context.supabase
      .from("document_templates")
      .update({ schema, ...metadata } as never)
      .eq("id", data.template_id);

    if (updErr) throw new Error(updErr.message);

    return {
      keys,
      fields,
      added,
      file_format: format,
      metadata: {
        name_ru: metadata.name_ru ?? row.name_ru ?? "",
        name_kk: metadata.name_kk ?? row.name_kk ?? "",
        description: metadata.description ?? row.description ?? null,
        category: metadata.category ?? row.category ?? "general",
      },
      metadata_updated: Object.keys(metadata).length > 0,
    };
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
      document_type_id: z.string().uuid().nullable().optional(),
      priority_id: z.string().uuid().nullable().optional(),
      correspondent_id: z.string().uuid().nullable().optional(),
      due_at: z.string().nullable().optional(),
      workflow_id: z.string().uuid().nullable().optional(),
      custom_route: customRouteSchema,
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceLicense(context.supabase, { writable: true, feature: "templates" });
    const { supabase, userId } = context;
    const tpl = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", data.template_id)
      .single();
    if (tpl.error) throw new Error(tpl.error.message);

    const tplRow = tpl.data as {
      name_ru: string;
      name_kk: string;
      schema?: {
        body_template?: string;
        title_template_ru?: string;
        title_template_kk?: string;
        fields?: Array<{ key: string; required?: boolean }>;
      };
      default_workflow_id?: string | null;
      status?: string;
      file_path?: string | null;
      file_format?: string | null;
    };

    if (tplRow.status && tplRow.status !== "published") {
      throw new Error("Шаблон не опубликован");
    }

    const schema = tplRow.schema || {};
    const bodyTemplate = schema.body_template || "";

    const authorDefaults = await buildTemplateAuthorDefaultsForUser(userId);
    const mergedValues = { ...authorDefaults, ...data.values };

    for (const field of schema.fields ?? []) {
      if (field.required && !mergedValues[field.key]?.trim()) {
        throw new Error(`Поле «${field.key}» обязательно для заполнения`);
      }
    }

    const workflowId =
      data.workflow_id !== undefined
        ? data.workflow_id
        : (tplRow.default_workflow_id ?? null);

    const resolvedTitles = resolveDocumentTitles(
      {
        name_ru: tplRow.name_ru,
        name_kk: tplRow.name_kk,
        schema: tplRow.schema,
      },
      mergedValues,
    );
    const titleRu = resolvedTitles.title_ru || data.title_ru;
    const titleKk = resolvedTitles.title_kk || data.title_kk || titleRu;

    const preValues = {
      ...buildSystemTemplateValues({ title_ru: titleRu, title_kk: titleKk }),
      ...mergedValues,
    };
    let body = bodyTemplate ? substituteTemplateBody(bodyTemplate, preValues) : "";

    const refs = await resolveDocumentReferences(supabaseAdmin, {
      document_type_id: data.document_type_id,
      priority_id: data.priority_id,
      correspondent_id: data.correspondent_id,
      due_at: data.due_at,
    });

    const { data: doc, error } = await (supabaseAdmin.from("documents") as any)
      .insert({
        title_ru: titleRu,
        title_kk: titleKk,
        body,
        template_id: data.template_id,
        nomenclature_id: data.nomenclature_id ?? null,
        doc_type: refs.doc_type,
        document_type_id: refs.document_type_id,
        priority_id: refs.priority_id,
        correspondent_id: refs.correspondent_id,
        due_at: refs.due_at,
        created_by: userId,
        workflow_id: workflowId,
        custom_route: data.custom_route ?? null,
        reg_number: "",
      })
      .select("id, reg_number")
      .single();
    if (error) throw new Error(error.message);

    const regNumber = await ensureDocumentRegNumber(doc.id);
    const finalValues = {
      ...preValues,
      ...buildSystemTemplateValues({
        title_ru: titleRu,
        title_kk: titleKk,
        reg_number: regNumber,
      }),
    };

    if (
      bodyTemplate &&
      (bodyTemplate.includes("{{registration_number}}") || bodyTemplate.includes("{{reg_number}}"))
    ) {
      body = substituteTemplateBody(bodyTemplate, finalValues);
      await supabaseAdmin.from("documents").update({ body }).eq("id", doc.id);
    }

    const fileFormat = tplRow.file_format as TemplateFileFormat | null;
    const hasFileTemplate =
      tplRow.file_path && fileFormat && supportsTemplateProcessing(fileFormat);

    if (hasFileTemplate) {
      try {
        const templateBuffer = await downloadTemplateBuffer(tplRow.file_path!);
        const rendered = await renderTemplateFile(templateBuffer, fileFormat!, finalValues);
        const filename = `document.${fileFormat}`;
        const storagePath = documentVersionPath(doc.id, 1, filename);

        const { error: uploadErr } = await supabaseAdmin.storage
          .from(STORAGE_BUCKETS.documents)
          .upload(storagePath, rendered, {
            contentType: templateMimeType(fileFormat!),
            upsert: true,
          });
        if (uploadErr) throw new Error(uploadErr.message);

        const { error: versionErr } = await supabaseAdmin.from("document_versions").insert({
          document_id: doc.id,
          version_no: 1,
          file_path: storagePath,
          file_format: fileFormat,
          comment: null,
          created_by: userId,
        } as never);
        if (versionErr) throw new Error(versionErr.message);

        await supabaseAdmin
          .from("documents")
          .update({ current_version: 1 } as never)
          .eq("id", doc.id);
      } catch (fileErr) {
        console.error("Template file render failed:", fileErr);
      }
    }

    return { ...doc, reg_number: regNumber, body };
  });
