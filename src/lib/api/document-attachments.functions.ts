import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanEditDocument, assertCanViewDocument } from "@/lib/api/document-access.server";
import { requireModuleAccess } from "./_helpers";
import {
  STORAGE_BUCKETS,
  documentAttachmentPath,
  parseDocumentIdFromPath,
} from "@/lib/storage/buckets";

const attachmentRowSelect =
  "id, document_id, file_name, file_path, file_size, mime_type, sort_order, created_at, created_by";

export const listDocumentAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ document_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanViewDocument(supabase, userId, data.document_id);

    const { data: rows, error } = await supabase
      .from("document_attachments")
      .select(attachmentRowSelect)
      .eq("document_id", data.document_id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const prepareDocumentAttachmentUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      filename: z.string().min(1).max(255),
      file_size: z.number().int().min(0).max(100 * 1024 * 1024).optional(),
      mime_type: z.string().max(128).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "documents", { action: "write" });
    const { supabase, userId } = context;
    await assertCanEditDocument(supabase, userId, data.document_id);

    const attachmentId = randomUUID();
    const storagePath = documentAttachmentPath(data.document_id, attachmentId, data.filename);

    const ext = data.filename.split(".").pop()?.toLowerCase() ?? "";
    const mimeByExt: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      zip: "application/zip",
    };

    return {
      bucket: STORAGE_BUCKETS.documents,
      attachment_id: attachmentId,
      storage_path: storagePath,
      file_format: ext || null,
      content_type: data.mime_type ?? mimeByExt[ext] ?? "application/octet-stream",
      file_size: data.file_size ?? null,
      user_id: userId,
    };
  });

export const registerDocumentAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      attachment_id: z.string().uuid(),
      storage_path: z.string().min(1).max(1024),
      file_name: z.string().min(1).max(255),
      file_size: z.number().int().min(0).optional().nullable(),
      mime_type: z.string().max(128).optional().nullable(),
      sort_order: z.number().int().min(0).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "documents", { action: "write" });
    const { supabase, userId } = context;

    const docIdFromPath = parseDocumentIdFromPath(data.storage_path);
    if (docIdFromPath !== data.document_id) {
      throw new Error("Некорректный путь файла");
    }

    await assertCanEditDocument(supabase, userId, data.document_id);

    const folder = `${data.document_id}/attachments/${data.attachment_id}`;
    const { data: listed, error: listErr } = await supabase.storage
      .from(STORAGE_BUCKETS.documents)
      .list(folder);

    if (listErr) throw new Error(listErr.message);
    if (!listed?.length) {
      throw new Error("Файл не найден в хранилище. Сначала выполните загрузку.");
    }

    const { count, error: countErr } = await supabase
      .from("document_attachments")
      .select("id", { count: "exact", head: true })
      .eq("document_id", data.document_id);
    if (countErr) throw new Error(countErr.message);

    const { data: row, error } = await supabase
      .from("document_attachments")
      .insert({
        id: data.attachment_id,
        document_id: data.document_id,
        file_name: data.file_name,
        file_path: data.storage_path,
        file_size: data.file_size ?? null,
        mime_type: data.mime_type ?? null,
        sort_order: data.sort_order ?? count ?? 0,
        created_by: userId,
      } as never)
      .select(attachmentRowSelect)
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDocumentAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "documents", { action: "write" });
    const { supabase, userId } = context;

    const { data: row, error: fetchErr } = await supabase
      .from("document_attachments")
      .select("id, document_id, file_path, created_by")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Вложение не найдено");

    const attachment = row as {
      id: string;
      document_id: string;
      file_path: string;
      created_by: string;
    };

    await assertCanEditDocument(supabase, userId, attachment.document_id);

    const { error: delErr } = await supabase
      .from("document_attachments")
      .delete()
      .eq("id", attachment.id);

    if (delErr) throw new Error(delErr.message);

    await supabase.storage.from(STORAGE_BUCKETS.documents).remove([attachment.file_path]);

    return { ok: true };
  });
