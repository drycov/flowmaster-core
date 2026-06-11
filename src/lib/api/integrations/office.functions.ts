import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAppOrigin, resolveOfficeUrl } from "@/lib/app-origin.server";
import { assertCanViewDocumentContent } from "@/lib/api/document-access.server";
import { requireModuleAccess } from "../_helpers";
import { createSignedDownloadUrl, createAdminSignedDownloadUrl } from "@/lib/storage/s3.server";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import {
  officeDocumentKey,
  officeTemplateKey,
  officeTemplatePreviewKey,
} from "@/lib/office/keys.server";
import { signOnlyOfficeConfig } from "@/lib/office/jwt.server";
import type { OnlyOfficeEditorConfig } from "@/lib/office/config.types";
import {
  downloadTemplateBuffer,
  renderTemplateFile,
} from "@/lib/templates/file-processing.server";
import {
  supportsTemplateProcessing,
  templateMimeType,
  type TemplateFileFormat,
} from "@/lib/templates/file-formats";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash } from "node:crypto";
import {
  initializeDocumentOfficeFile,
  resolveOfficeInitOptions,
  type OfficeFileInitMode,
  type OfficeInitOptions,
} from "@/lib/office/document-file-init.server";

export type { OfficeFileInitMode, OfficeInitOptions } from "@/lib/office/document-file-init.server";
export type { OnlyOfficeEditorConfig } from "@/lib/office/config.types";

export type OfficeUnavailableReason = "office_not_licensed" | "office_not_configured" | "no_file_version";

export type OfficeEditorConfigResponse =
  | {
      available: false;
      office_url: string | null;
      reason: OfficeUnavailableReason;
      init_options?: OfficeInitOptions;
    }
  | {
      available: true;
      office_url: string;
      document_server_url: string;
      config: OnlyOfficeEditorConfig;
    };

export function isOfficeNotConfigured(
  config: OfficeEditorConfigResponse | undefined,
): boolean {
  return Boolean(
    config &&
      !config.available &&
      (config.reason === "office_not_configured" || config.reason === "office_not_licensed"),
  );
}

async function ensureOfficeModuleAccess(
  supabase: SupabaseClient,
  userId: string,
  write: boolean,
): Promise<OfficeUnavailableReason | null> {
  try {
    await requireModuleAccess(supabase, userId, "office", { action: write ? "write" : "read" });
    return null;
  } catch {
    return "office_not_licensed";
  }
}

function officeFileTypes(format: string) {
  const ext = format.toLowerCase();
  const fileType =
    ext === "doc" ? "doc" : ext === "xlsx" ? "xlsx" : ext === "xls" ? "xls" : "docx";
  const documentType = fileType.startsWith("xls") ? "cell" : "word";
  return { fileType, documentType };
}

function officeDocumentPermissions(readOnly: boolean): Record<string, boolean> {
  if (readOnly) {
    return {
      edit: false,
      download: true,
      print: true,
      copy: true,
      fillForms: true,
      modifyFilter: false,
      review: false,
      comment: false,
    };
  }
  return {
    edit: true,
    download: true,
    print: true,
    copy: true,
    fillForms: true,
    modifyFilter: true,
    review: true,
    comment: true,
  };
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
  // ONLYOFFICE fetches files server-side — service-role URL avoids RLS/signed-url edge cases.
  const signedUrl = await createAdminSignedDownloadUrl(input.bucket, input.storagePath, 3600);

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

  const rawConfig: OnlyOfficeEditorConfig = {
    document: {
      fileType,
      key: input.documentKey,
      title: input.title,
      url: rewriteOfficeStorageUrl(signedUrl),
      permissions: officeDocumentPermissions(input.readOnly),
    },
    documentType,
    editorConfig: {
      ...(callbackUrl && !input.readOnly ? { callbackUrl } : {}),
      mode: input.readOnly ? "view" : "edit",
      lang: "ru",
      user: {
        id: input.userId,
        name: profile?.full_name_ru ?? profile?.email ?? input.userId,
      },
      customization: {
        forcesave: !input.readOnly,
        chat: false,
        ...(input.readOnly ? { comments: false } : {}),
      },
    },
  };

  return {
    available: true as const,
    office_url: input.officeUrl,
    document_server_url: input.officeUrl,
    config: signOnlyOfficeConfig(rawConfig),
  };
}

export const getOfficeEditorConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ document_id: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<OfficeEditorConfigResponse> => {
    await requireModuleAccess(context.supabase, context.userId, "documents", { action: "write" });
    const { supabase, userId } = context;
    await assertCanViewDocumentContent(supabase, userId, data.document_id);

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, title_ru, current_version, updated_at, status, created_by, template_id")
      .eq("id", data.document_id)
      .single();
    if (docErr || !doc) throw new Error("Документ не найден");

    const readOnly = !["draft", "returned_for_revision"].includes(doc.status);
    const licenseBlock = await ensureOfficeModuleAccess(supabase, userId, !readOnly);
    if (licenseBlock) {
      return {
        available: false as const,
        office_url: null,
        reason: licenseBlock,
      };
    }

    const officeUrl = await resolveOfficeUrl();
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

    let fileVersion = version?.file_path ? version : null;
    if (!fileVersion) {
      const { data: latestFileVersion } = await supabase
        .from("document_versions")
        .select("id, version_no, file_path, file_format")
        .eq("document_id", data.document_id)
        .not("file_path", "is", null)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      fileVersion = latestFileVersion ?? null;
    }

    if (!fileVersion?.file_path) {
      const initOptions = await resolveOfficeInitOptions(
        supabase,
        userId,
        data.document_id,
        doc.template_id,
      );
      return {
        available: false as const,
        office_url: officeUrl,
        reason: "no_file_version" as const,
        init_options: initOptions,
      };
    }

    const key = officeDocumentKey(doc.id, fileVersion.version_no, doc.updated_at);

    return buildEditorPayload({
      supabase,
      userId,
      bucket: STORAGE_BUCKETS.documents,
      storagePath: fileVersion.file_path,
      fileFormat: fileVersion.file_format ?? "docx",
      title: doc.title_ru,
      documentKey: key,
      readOnly,
      officeUrl,
    });
  });

export const getTemplateOfficeEditorConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ template_id: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<OfficeEditorConfigResponse> => {
    await requireModuleAccess(context.supabase, context.userId, "templates", { action: "manage" });
    const { supabase, userId } = context;

    const { data: tpl, error } = await supabase
      .from("document_templates")
      .select("id, name_ru, file_path, file_format, updated_at, status")
      .eq("id", data.template_id)
      .single();
    if (error || !tpl) throw new Error("Шаблон не найден");

    const readOnly = tpl.status !== "draft";
    const licenseBlock = await ensureOfficeModuleAccess(supabase, userId, !readOnly);
    if (licenseBlock) {
      return {
        available: false as const,
        office_url: null,
        reason: licenseBlock,
      };
    }

    const officeUrl = await resolveOfficeUrl();
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

function previewValuesHash(values: Record<string, string>): string {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex").slice(0, 16);
}

function templateOfficePreviewPath(templateId: string, format: string): string {
  return `${templateId}/_office_preview/preview.${format}`;
}

export const getTemplateOfficePreviewConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      template_id: z.string().uuid(),
      preview_values: z.record(z.string(), z.string()).default({}),
    }),
  )
  .handler(async ({ data, context }): Promise<OfficeEditorConfigResponse> => {
    await requireModuleAccess(context.supabase, context.userId, "templates", { action: "manage" });
    const { supabase, userId } = context;

    const licenseBlock = await ensureOfficeModuleAccess(supabase, userId, false);
    if (licenseBlock) {
      return {
        available: false as const,
        office_url: null,
        reason: licenseBlock,
      };
    }

    const officeUrl = await resolveOfficeUrl();

    const { data: tpl, error } = await supabase
      .from("document_templates")
      .select("id, name_ru, file_path, file_format, updated_at")
      .eq("id", data.template_id)
      .single();
    if (error || !tpl) throw new Error("Шаблон не найден");

    if (!officeUrl) {
      return {
        available: false as const,
        office_url: null,
        reason: "office_not_configured" as const,
      };
    }

    if (!tpl.file_path) {
      return {
        available: false as const,
        office_url: officeUrl,
        reason: "no_file_version" as const,
      };
    }

    const format = (tpl.file_format ?? "docx") as TemplateFileFormat;
    const valuesHash = previewValuesHash(data.preview_values);
    const previewPath = templateOfficePreviewPath(data.template_id, format);

    let previewBuffer = await downloadTemplateBuffer(tpl.file_path);
    if (supportsTemplateProcessing(format) && Object.keys(data.preview_values).length > 0) {
      previewBuffer = await renderTemplateFile(previewBuffer, format, data.preview_values);
    }

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.templates)
      .upload(previewPath, previewBuffer, {
        upsert: true,
        contentType: templateMimeType(format),
      });
    if (uploadErr) throw new Error(`Не удалось подготовить предпросмотр: ${uploadErr.message}`);

    const key = officeTemplatePreviewKey(data.template_id, `${tpl.updated_at}:${valuesHash}`);

    return buildEditorPayload({
      supabase,
      userId,
      bucket: STORAGE_BUCKETS.templates,
      storagePath: previewPath,
      fileFormat: format,
      title: `${tpl.name_ru} — предпросмотр`,
      documentKey: key,
      readOnly: true,
      officeUrl,
    });
  });

export const initializeDocumentOfficeFileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      mode: z.enum(["blank_docx", "blank_xlsx", "from_template"]),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "documents", { action: "write" });
    const licenseBlock = await ensureOfficeModuleAccess(context.supabase, context.userId, true);
    if (licenseBlock) throw new Error("Модуль ONLYOFFICE недоступен в текущем тарифном плане");
    await assertCanViewDocumentContent(context.supabase, context.userId, data.document_id);
    return initializeDocumentOfficeFile({
      supabase: context.supabase,
      userId: context.userId,
      documentId: data.document_id,
      mode: data.mode as OfficeFileInitMode,
    });
  });
