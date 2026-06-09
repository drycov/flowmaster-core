import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STORAGE_BUCKETS, documentVersionPath } from "@/lib/storage/buckets";
import {
  templateMimeType,
  type TemplateFileFormat,
} from "@/lib/templates/file-formats";
import {
  downloadTemplateBuffer,
  renderTemplateFile,
} from "@/lib/templates/file-processing.server";

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
  const rendered = await renderTemplateFile(
    templateBuffer,
    options.fileFormat,
    options.values,
  );
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

  const { error: versionErr } = await supabaseAdmin.from("document_versions").insert({
    document_id: options.documentId,
    version_no: versionNo,
    file_path: storagePath,
    file_format: options.fileFormat,
    comment: null,
    created_by: options.userId,
  } as never);
  if (versionErr) throw new Error(versionErr.message);

  const { error: docErr } = await supabaseAdmin
    .from("documents")
    .update({ current_version: versionNo } as never)
    .eq("id", options.documentId);
  if (docErr) throw new Error(docErr.message);
}
