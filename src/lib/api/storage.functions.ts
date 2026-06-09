import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceLicense, requirePermission } from "./_helpers";
import {
  STORAGE_BUCKETS,
  documentVersionPath,
  parseDocumentIdFromPath,
  templateFilePath,
  type StorageBucket,
} from "@/lib/storage/buckets";
import { createSignedDownloadUrl, getS3PublicInfo } from "@/lib/storage/s3.server";
import {
  detectTemplateFormat,
  templateMimeType,
  type TemplateFileFormat,
} from "@/lib/templates/file-formats";

const bucketSchema = z.enum([
  STORAGE_BUCKETS.avatars,
  STORAGE_BUCKETS.documents,
  STORAGE_BUCKETS.templates,
]);

/** Signed URL for private bucket download (auth + storage RLS). */
export const getSignedDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      bucket: bucketSchema,
      path: z.string().min(1).max(1024),
      expires_in: z.number().min(60).max(86400).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const url = await createSignedDownloadUrl(
      context.supabase,
      data.bucket as StorageBucket,
      data.path,
      data.expires_in ?? 3600,
    );
    return { signed_url: url, expires_in: data.expires_in ?? 3600 };
  });

/** Prepare path for client-side authenticated upload to documents bucket. */
export const prepareDocumentVersionUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      filename: z.string().min(1).max(255),
      comment: z.string().max(2000).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceLicense(context.supabase, { writable: true });
    const { supabase, userId } = context;

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, current_version, created_by")
      .eq("id", data.document_id)
      .single();

    if (docErr || !doc) throw new Error("Документ не найден");

    const { data: versions } = await supabase
      .from("document_versions")
      .select("version_no")
      .eq("document_id", data.document_id)
      .order("version_no", { ascending: false })
      .limit(1);

    const nextVersion =
      Math.max(doc.current_version ?? 0, versions?.[0]?.version_no ?? 0) + 1;

    const storagePath = documentVersionPath(
      data.document_id,
      nextVersion,
      data.filename,
    );

    const ext = data.filename.split(".").pop()?.toLowerCase() ?? "";
    const mimeByExt: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    return {
      bucket: STORAGE_BUCKETS.documents,
      storage_path: storagePath,
      version_no: nextVersion,
      file_format: ext || null,
      content_type: mimeByExt[ext] ?? "application/octet-stream",
      comment: data.comment ?? null,
      user_id: userId,
    };
  });

/** Register uploaded file as document version (after client upload). */
export const registerDocumentVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      storage_path: z.string().min(1).max(1024),
      version_no: z.number().int().min(1),
      file_format: z.string().max(32).optional().nullable(),
      comment: z.string().max(2000).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceLicense(context.supabase, { writable: true });
    const { supabase, userId } = context;

    const docIdFromPath = parseDocumentIdFromPath(data.storage_path);
    if (docIdFromPath !== data.document_id) {
      throw new Error("Некорректный путь файла");
    }

    const { data: listed, error: listErr } = await supabase.storage
      .from(STORAGE_BUCKETS.documents)
      .list(`${data.document_id}/v${data.version_no}`);

    if (listErr) throw new Error(listErr.message);
    if (!listed?.length) {
      throw new Error("Файл не найден в хранилище. Сначала выполните загрузку.");
    }

    const { data: version, error } = await supabase
      .from("document_versions")
      .insert({
        document_id: data.document_id,
        version_no: data.version_no,
        file_path: data.storage_path,
        file_format: data.file_format ?? null,
        comment: data.comment ?? null,
        created_by: userId,
      } as never)
      .select("id, version_no, file_path, file_format, created_at")
      .single();

    if (error) throw new Error(error.message);

    await supabase
      .from("documents")
      .update({ current_version: data.version_no } as never)
      .eq("id", data.document_id);

    return version;
  });

/** Upload template file to storage and link to template record. */
export const uploadTemplateFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      template_id: z.string().uuid(),
      storage_path: z.string().min(1).max(1024),
    }),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase, context.userId, "manage_templates");
    await enforceLicense(context.supabase, { writable: true, feature: "templates" });

    const expectedPrefix = `${data.template_id}/`;
    if (!data.storage_path.startsWith(expectedPrefix)) {
      throw new Error("Некорректный путь шаблона");
    }

    const filename = data.storage_path.slice(expectedPrefix.length);
    const format = detectTemplateFormat(filename);
    if (!format) {
      throw new Error("Неподдерживаемый формат файла. Допустимы: DOC, DOCX, XLS, XLSX");
    }

    const folder = data.storage_path.slice(0, data.storage_path.lastIndexOf("/"));
    const { data: listed, error: listErr } = await context.supabase.storage
      .from(STORAGE_BUCKETS.templates)
      .list(folder);

    if (listErr) throw new Error(listErr.message);
    const uploaded = listed?.some((f) => data.storage_path.endsWith(`/${f.name}`));
    if (!uploaded) {
      throw new Error("Файл не найден в хранилище. Сначала выполните загрузку.");
    }

    const { error } = await context.supabase
      .from("document_templates")
      .update({ file_path: data.storage_path, file_format: format } as never)
      .eq("id", data.template_id);

    if (error) throw new Error(error.message);
    return { ok: true, storage_path: data.storage_path, file_format: format };
  });

/** Prepare path for template file upload (client uploads with auth). */
export const prepareTemplateUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      template_id: z.string().uuid(),
      filename: z.string().min(1).max(255),
    }),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase, context.userId, "manage_templates");
    await enforceLicense(context.supabase, { writable: true, feature: "templates" });

    const format = detectTemplateFormat(data.filename);
    if (!format) {
      throw new Error("Неподдерживаемый формат файла. Допустимы: DOC, DOCX, XLS, XLSX");
    }

    const storagePath = templateFilePath(data.template_id, data.filename);
    return {
      bucket: STORAGE_BUCKETS.templates,
      storage_path: storagePath,
      file_format: format as TemplateFileFormat,
      content_type: templateMimeType(format),
    };
  });

/** S3 endpoint info for external integrations (no secrets). */
export const getStorageS3Info = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePermission(context.supabase, context.userId, "manage_templates");
    return getS3PublicInfo();
  });
