import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STORAGE_BUCKETS, documentVersionPath } from "@/lib/storage/buckets";
import { templateMimeType, type TemplateFileFormat } from "@/lib/templates/file-formats";
import { downloadTemplateBuffer, renderTemplateFile } from "@/lib/templates/file-processing.server";

export async function resolveNextDocumentVersionNo(
  supabase: SupabaseClient,
  documentId: string,
): Promise<number> {
  const { data: doc } = await supabase
    .from("documents")
    .select("current_version")
    .eq("id", documentId)
    .maybeSingle();

  const { data: versions } = await supabase
    .from("document_versions")
    .select("version_no")
    .eq("document_id", documentId)
    .order("version_no", { ascending: false })
    .limit(1);

  return (
    Math.max(
      (doc as { current_version?: number } | null)?.current_version ?? 0,
      versions?.[0]?.version_no ?? 0,
    ) + 1
  );
}

type DocumentVersionRowInput = {
  documentId: string;
  versionNo: number;
  userId: string;
  file_path?: string | null;
  file_format?: string | null;
  body_snapshot?: string | null;
  content_hash?: string | null;
  comment?: string | null;
};

export async function registerDocumentVersionRow(
  supabase: SupabaseClient,
  input: DocumentVersionRowInput,
  select = "id, version_no, file_path, file_format, created_at",
): Promise<Record<string, unknown> | null> {
  const { data, error: versionErr } = await supabase
    .from("document_versions")
    .insert({
      document_id: input.documentId,
      version_no: input.versionNo,
      file_path: input.file_path ?? null,
      file_format: input.file_format ?? null,
      body_snapshot: input.body_snapshot ?? null,
      content_hash: input.content_hash ?? null,
      comment: input.comment ?? null,
      created_by: input.userId,
    } as never)
    .select(select)
    .maybeSingle();
  if (versionErr) throw new Error(versionErr.message);

  const { error: docErr } = await supabase
    .from("documents")
    .update({ current_version: input.versionNo } as never)
    .eq("id", input.documentId);
  if (docErr) throw new Error(docErr.message);

  return (data as Record<string, unknown> | null) ?? null;
}

export async function registerBodyContentVersion(
  supabase: SupabaseClient,
  options: {
    documentId: string;
    userId: string;
    body: string;
    comment?: string;
  },
): Promise<number> {
  const versionNo = await resolveNextDocumentVersionNo(supabase, options.documentId);

  const { data: latestFileVersion } = await supabase
    .from("document_versions")
    .select("file_path, file_format")
    .eq("document_id", options.documentId)
    .not("file_path", "is", null)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { sha256Hex } = await import("@/lib/documents/content-hash.server");
  await registerDocumentVersionRow(supabase, {
    documentId: options.documentId,
    versionNo,
    userId: options.userId,
    file_path: latestFileVersion?.file_path ?? null,
    file_format: latestFileVersion?.file_format ?? null,
    body_snapshot: options.body,
    content_hash: sha256Hex(options.body),
    comment: options.comment ?? "Редактирование содержимого",
  });
  return versionNo;
}

export async function registerUploadedFileVersion(
  supabase: SupabaseClient,
  options: {
    documentId: string;
    userId: string;
    versionNo: number;
    storagePath: string;
    fileFormat?: string | null;
    comment?: string | null;
    bodySnapshot?: string | null;
  },
) {
  const contentHash = options.bodySnapshot
    ? (await import("@/lib/documents/content-hash.server")).sha256Hex(options.bodySnapshot)
    : null;

  const row = await registerDocumentVersionRow(supabase, {
    documentId: options.documentId,
    versionNo: options.versionNo,
    userId: options.userId,
    file_path: options.storagePath,
    file_format: options.fileFormat ?? null,
    body_snapshot: options.bodySnapshot ?? null,
    content_hash: contentHash,
    comment: options.comment ?? null,
  });

  return (
    row ?? {
      version_no: options.versionNo,
      file_path: options.storagePath,
      file_format: options.fileFormat ?? null,
    }
  );
}

export async function registerInitialFileVersion(options: {
  documentId: string;
  userId: string;
  templateFilePath: string;
  fileFormat: TemplateFileFormat;
  values: Record<string, string>;
  versionNo?: number;
}): Promise<void> {
  const versionNo = options.versionNo ?? 1;
  const templateBuffer = await downloadTemplateBuffer(options.templateFilePath);
  const rendered = await renderTemplateFile(templateBuffer, options.fileFormat, options.values);
  const storagePath = documentVersionPath(
    options.documentId,
    versionNo,
    `document.${options.fileFormat}`,
  );

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.documents)
    .upload(storagePath, rendered, {
      contentType: templateMimeType(options.fileFormat),
      upsert: true,
    });
  if (uploadErr) throw new Error(uploadErr.message);

  await registerDocumentVersionRow(supabaseAdmin, {
    documentId: options.documentId,
    versionNo,
    userId: options.userId,
    file_path: storagePath,
    file_format: options.fileFormat,
  });
}
