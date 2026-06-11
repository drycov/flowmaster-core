import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAppOrigin, resolveOfficeUrl } from "@/lib/app-origin.server";
import { assertCanViewDocumentContent } from "@/lib/api/document-access.server";
import { requireModuleAccess } from "./_helpers";
import { createSignedDownloadUrl } from "@/lib/storage/s3.server";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import { officeDocumentKey, officeTemplateKey } from "@/lib/office/keys.server";

function officeFileTypes(format: string) {
  const ext = format.toLowerCase();
  const fileType =
    ext === "doc" ? "doc" : ext === "xlsx" ? "xlsx" : ext === "xls" ? "xls" : "docx";
  const documentType = fileType.startsWith("xls") ? "cell" : "word";
  return { fileType, documentType };
}

async function buildEditorPayload(input: {
  supabase: Parameters<typeof createSignedDownloadUrl>[0];
  userId: string;
  bucket: (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
  storagePath: string;
  fileFormat: string;
  title: string;
  documentKey: string;
  readOnly: boolean;
  officeUrl: string;
}) {
  const { fileType, documentType } = officeFileTypes(input.fileFormat);
  const signedUrl = await createSignedDownloadUrl(
    input.supabase,
    input.bucket,
    input.storagePath,
    3600,
  );

  const { data: profile } = await input.supabase
    .from("profiles")
    .select("full_name_ru, email")
    .eq("id", input.userId)
    .maybeSingle();

  const { resolveOfficeCallbackBase, rewriteOfficeStorageUrl } = await import(
    "@/lib/office/office-env.server"
  );
  const callbackBase = await resolveOfficeCallbackBase(resolveAppOrigin);
  const callbackUrl = callbackBase ? `${callbackBase}/api/public/hooks/office-callback` : "";

  return {
    available: true as const,
    office_url: input.officeUrl,
    document_server_url: input.officeUrl,
    config: {
      document: {
        fileType,
        key: input.documentKey,
        title: input.title,
        url: rewriteOfficeStorageUrl(signedUrl),
      },
      documentType,
      editorConfig: {
        callbackUrl,
        mode: input.readOnly ? "view" : "edit",
        lang: "ru",
        user: {
          id: input.userId,
          name: profile?.full_name_ru ?? profile?.email ?? input.userId,
        },
        customization: {
          forcesave: true,
        },
      },
    },
  };
}

export const getOfficeEditorConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ document_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "documents", { action: "write" });
    const { supabase, userId } = context;
    await assertCanViewDocumentContent(supabase, userId, data.document_id);
    const officeUrl = await resolveOfficeUrl();

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, title_ru, current_version, updated_at, status, created_by")
      .eq("id", data.document_id)
      .single();
    if (docErr || !doc) throw new Error("Документ не найден");

    if (!officeUrl) {
      return {
        available: false as const,
        office_url: null,
        reason: "office_not_configured",
      };
    }

    const { data: version } = await supabase
      .from("document_versions")
      .select("id, version_no, file_path, file_format")
      .eq("document_id", data.document_id)
      .eq("version_no", doc.current_version)
      .maybeSingle();

    if (!version?.file_path) {
      return {
        available: false as const,
        office_url: officeUrl,
        reason: "no_file_version",
      };
    }

    const readOnly = !["draft", "returned_for_revision"].includes(doc.status);
    const key = officeDocumentKey(doc.id, version.version_no, doc.updated_at);

    return buildEditorPayload({
      supabase,
      userId,
      bucket: STORAGE_BUCKETS.documents,
      storagePath: version.file_path,
      fileFormat: version.file_format ?? "docx",
      title: doc.title_ru,
      documentKey: key,
      readOnly,
      officeUrl,
    });
  });

export const getTemplateOfficeEditorConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ template_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "templates", { action: "manage" });
    const { supabase, userId } = context;
    const officeUrl = await resolveOfficeUrl();

    const { data: tpl, error } = await supabase
      .from("document_templates")
      .select("id, name_ru, file_path, file_format, updated_at, status")
      .eq("id", data.template_id)
      .single();
    if (error || !tpl) throw new Error("Шаблон не найден");

    if (!officeUrl) {
      return {
        available: false as const,
        office_url: null,
        reason: "office_not_configured",
      };
    }

    if (!tpl.file_path) {
      return {
        available: false as const,
        office_url: officeUrl,
        reason: "no_file_version",
      };
    }

    const readOnly = tpl.status !== "draft";
    const key = officeTemplateKey(tpl.id, tpl.updated_at, tpl.file_path);

    return buildEditorPayload({
      supabase,
      userId,
      bucket: STORAGE_BUCKETS.templates,
      storagePath: tpl.file_path,
      fileFormat: tpl.file_format ?? "docx",
      title: tpl.name_ru,
      documentKey: key,
      readOnly,
      officeUrl,
    });
  });
