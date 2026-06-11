import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertCanEditDocument } from "@/lib/api/document-access.server";
import {
  registerDocumentVersionRow,
  registerInitialFileVersion,
  resolveNextDocumentVersionNo,
} from "@/lib/documents/versions.server";
import { STORAGE_BUCKETS, documentVersionPath } from "@/lib/storage/buckets";
import {
  supportsTemplateProcessing,
  type TemplateFileFormat,
} from "@/lib/templates/file-formats";
import { buildTemplateAuthorDefaultsForUser } from "@/lib/templates/author-defaults.server";
import { buildSystemTemplateValues } from "@/lib/templates/system-values";
import { blankOfficeMimeType, createBlankOfficeFile } from "./blank-files.server";

export type OfficeFileInitMode = "blank_docx" | "blank_xlsx" | "from_template";

export type OfficeInitOptions = {
  can_edit: boolean;
  from_template: {
    template_id: string;
    name: string;
    file_format: string;
  } | null;
};

export async function resolveOfficeInitOptions(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
  templateId: string | null,
): Promise<OfficeInitOptions> {
  let canEdit = false;
  try {
    await assertCanEditDocument(supabase, userId, documentId);
    canEdit = true;
  } catch {
    canEdit = false;
  }

  if (!templateId) {
    return { can_edit: canEdit, from_template: null };
  }

  const { data: tpl } = await supabase
    .from("document_templates")
    .select("id, name_ru, file_path, file_format")
    .eq("id", templateId)
    .maybeSingle();

  if (
    !tpl?.file_path ||
    !tpl.file_format ||
    !supportsTemplateProcessing(tpl.file_format)
  ) {
    return { can_edit: canEdit, from_template: null };
  }

  return {
    can_edit: canEdit,
    from_template: {
      template_id: tpl.id,
      name: tpl.name_ru,
      file_format: tpl.file_format,
    },
  };
}

export async function initializeDocumentOfficeFile(options: {
  supabase: SupabaseClient;
  userId: string;
  documentId: string;
  mode: OfficeFileInitMode;
}): Promise<{ version_no: number; file_format: string }> {
  const { supabase, userId, documentId, mode } = options;
  await assertCanEditDocument(supabase, userId, documentId);

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, title_ru, title_kk, reg_number, template_id, body, created_by, current_version")
    .eq("id", documentId)
    .single();
  if (docErr || !doc) throw new Error("Документ не найден");

  const { data: existingFile } = await supabase
    .from("document_versions")
    .select("id")
    .eq("document_id", documentId)
    .not("file_path", "is", null)
    .limit(1)
    .maybeSingle();
  if (existingFile) {
    throw new Error("Файловая версия уже существует — обновите страницу");
  }

  if (mode === "from_template") {
    if (!doc.template_id) {
      throw new Error("Документ не связан с файловым шаблоном");
    }

    const { data: tpl, error: tplErr } = await supabase
      .from("document_templates")
      .select("file_path, file_format")
      .eq("id", doc.template_id)
      .single();
    if (tplErr || !tpl?.file_path || !tpl.file_format) {
      throw new Error("Файл шаблона не найден");
    }
    if (!supportsTemplateProcessing(tpl.file_format)) {
      throw new Error("Шаблон не поддерживает автогенерацию (нужен DOCX или XLSX)");
    }

    const authorDefaults = await buildTemplateAuthorDefaultsForUser(doc.created_by ?? userId);
    const values = {
      ...authorDefaults,
      ...buildSystemTemplateValues({
        title_ru: doc.title_ru,
        title_kk: doc.title_kk,
        reg_number: doc.reg_number ?? undefined,
      }),
    };

    const versionNo = await resolveNextDocumentVersionNo(supabaseAdmin, documentId);
    await registerInitialFileVersion({
      documentId,
      userId,
      templateFilePath: tpl.file_path,
      fileFormat: tpl.file_format as TemplateFileFormat,
      values,
      versionNo,
    });

    return { version_no: versionNo, file_format: tpl.file_format };
  }

  const format = mode === "blank_xlsx" ? "xlsx" : "docx";
  const buffer = await createBlankOfficeFile(format);
  const versionNo = await resolveNextDocumentVersionNo(supabaseAdmin, documentId);
  const storagePath = documentVersionPath(documentId, versionNo, `document.${format}`);

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.documents)
    .upload(storagePath, buffer, {
      contentType: blankOfficeMimeType(format),
      upsert: true,
    });
  if (uploadErr) throw new Error(uploadErr.message);

  await registerDocumentVersionRow(supabaseAdmin, {
    documentId,
    versionNo,
    userId,
    file_path: storagePath,
    file_format: format,
    body_snapshot: doc.body ?? null,
    comment: mode === "blank_xlsx" ? "Пустая таблица ONLYOFFICE" : "Пустой документ ONLYOFFICE",
  });

  return { version_no: versionNo, file_format: format };
}
