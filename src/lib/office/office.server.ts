import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import {
  detectTemplateFormat,
  templateMimeType,
  type TemplateFileFormat,
} from "@/lib/templates/file-formats";
import {
  officeDocumentKey,
  parseOfficeDocumentKey,
  parseOfficeTemplateKey,
} from "./keys.server";

export { officeDocumentKey, officeTemplateKey } from "./keys.server";

/** Process ONLYOFFICE save callback (status 2 = must save). */
export async function processOfficeCallback(body: { key?: string; status?: number; url?: string }) {
  if (body.status !== 2 || !body.url || !body.key) {
    return { ok: true, saved: false };
  }

  const templateId = parseOfficeTemplateKey(body.key);
  if (templateId) {
    return processTemplateOfficeSave(templateId, body.url);
  }

  const parsed = parseOfficeDocumentKey(body.key);
  if (!parsed) throw new Error("invalid office key");

  return processDocumentOfficeSave(parsed.documentId, body.url);
}

async function processDocumentOfficeSave(docId: string, downloadUrl: string) {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const { data: doc } = await supabaseAdmin
    .from("documents")
    .select("current_version, created_by")
    .eq("id", docId)
    .single();

  const nextVersion = (doc?.current_version ?? 0) + 1;
  const storagePath = `${docId}/v${nextVersion}/office-save.docx`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.documents)
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
  if (uploadErr) throw new Error(uploadErr.message);

  const contentHash = createHash("sha256").update(buffer).digest("hex");

  await supabaseAdmin.from("document_versions").insert({
    document_id: docId,
    version_no: nextVersion,
    file_path: storagePath,
    file_format: "docx",
    comment: "ONLYOFFICE",
    content_hash: contentHash,
    created_by: doc?.created_by,
  } as never);

  await supabaseAdmin
    .from("documents")
    .update({ current_version: nextVersion } as never)
    .eq("id", docId);

  return { ok: true, saved: true, version_no: nextVersion, entity: "document" as const };
}

async function processTemplateOfficeSave(templateId: string, downloadUrl: string) {
  const { data: tpl, error } = await supabaseAdmin
    .from("document_templates")
    .select("file_path, file_format")
    .eq("id", templateId)
    .single();

  if (error || !tpl?.file_path) throw new Error("Шаблон не найден");

  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const formatRaw = (tpl.file_format ?? "docx").toLowerCase();
  const format =
    detectTemplateFormat(`file.${formatRaw}`) ?? (formatRaw as TemplateFileFormat);
  const contentType = templateMimeType(format);

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.templates)
    .upload(tpl.file_path, buffer, { contentType, upsert: true });
  if (uploadErr) throw new Error(uploadErr.message);

  await supabaseAdmin
    .from("document_templates")
    .update({ updated_at: new Date().toISOString() } as never)
    .eq("id", templateId);

  return { ok: true, saved: true, entity: "template" as const, template_id: templateId };
}
