import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import {
  detectTemplateFormat,
  templateMimeType,
  type TemplateFileFormat,
} from "@/lib/templates/file-formats";
import { extractDocxPlainText } from "@/lib/office/docx-text.server";
import { fetchOfficeDownload } from "./office-download.server";
import {
  officeDocumentKey,
  officeTemplateKey,
  parseOfficeDocumentKey,
  parseOfficeTemplateKey,
} from "./keys.server";

export { officeDocumentKey, officeTemplateKey } from "./keys.server";

function keysMatch(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  } catch {
    return false;
  }
}

/** Process ONLYOFFICE save callback (status 2 = must save). Caller must authenticate the request. */
export async function processOfficeCallback(body: {
  key?: string;
  status?: number;
  url?: string;
}) {
  if (body.status !== 2 || !body.url || !body.key) {
    return { ok: true, saved: false };
  }

  const templateId = parseOfficeTemplateKey(body.key);
  if (templateId) {
    return processTemplateOfficeSave(templateId, body.key, body.url);
  }

  const parsed = parseOfficeDocumentKey(body.key);
  if (!parsed) throw new Error("invalid office key");

  return processDocumentOfficeSave(parsed.documentId, parsed.versionNo, body.key, body.url);
}

async function processDocumentOfficeSave(
  docId: string,
  versionNo: number,
  callbackKey: string,
  downloadUrl: string,
) {
  const { data: doc, error: docErr } = await supabaseAdmin
    .from("documents")
    .select("current_version, created_by, updated_at, status")
    .eq("id", docId)
    .single();

  if (docErr || !doc) throw new Error("Документ не найден");
  if (!["draft", "returned_for_revision"].includes(doc.status)) {
    throw new Error("Документ недоступен для сохранения");
  }

  const expectedKey = officeDocumentKey(docId, versionNo, doc.updated_at);
  if (!keysMatch(expectedKey, callbackKey)) {
    throw new Error("invalid office key");
  }

  const { data: fileVersion } = await supabaseAdmin
    .from("document_versions")
    .select("version_no, file_path")
    .eq("document_id", docId)
    .eq("version_no", versionNo)
    .maybeSingle();

  if (!fileVersion?.file_path) {
    throw new Error("Версия документа не найдена");
  }

  const buffer = await fetchOfficeDownload(downloadUrl);

  const nextVersion = (doc.current_version ?? 0) + 1;
  const storagePath = `${docId}/v${nextVersion}/office-save.docx`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.documents)
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
  if (uploadErr) throw new Error(uploadErr.message);

  const contentHash = createHash("sha256").update(buffer).digest("hex");
  const bodySnapshot = extractDocxPlainText(buffer);

  await supabaseAdmin.from("document_versions").insert({
    document_id: docId,
    version_no: nextVersion,
    file_path: storagePath,
    file_format: "docx",
    comment: "ONLYOFFICE",
    content_hash: contentHash,
    body_snapshot: bodySnapshot || null,
    created_by: doc.created_by,
  } as never);

  await supabaseAdmin
    .from("documents")
    .update({
      current_version: nextVersion,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", docId);

  return { ok: true, saved: true, version_no: nextVersion, entity: "document" as const };
}

async function processTemplateOfficeSave(
  templateId: string,
  callbackKey: string,
  downloadUrl: string,
) {
  const { data: tpl, error } = await supabaseAdmin
    .from("document_templates")
    .select("file_path, file_format, updated_at, status")
    .eq("id", templateId)
    .single();

  if (error || !tpl?.file_path) throw new Error("Шаблон не найден");
  if (tpl.status !== "draft") {
    throw new Error("Шаблон недоступен для сохранения");
  }

  const expectedKey = officeTemplateKey(templateId, tpl.updated_at, tpl.file_path);
  if (!keysMatch(expectedKey, callbackKey)) {
    throw new Error("invalid office key");
  }

  const buffer = await fetchOfficeDownload(downloadUrl);

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
