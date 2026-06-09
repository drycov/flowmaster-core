import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceLicense } from "./_helpers";
import { createSignedDownloadUrl } from "@/lib/storage/s3.server";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";

function resolveAppOrigin(): string {
  return (
    process.env.VITE_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:4000"
  ).replace(/\/$/, "");
}

export const getOfficeEditorConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ document_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { officeDocumentKey } = await import("@/lib/office/office.server");

    await enforceLicense(context.supabase, { writable: true });
    const { supabase, userId } = context;
    const officeUrl = (process.env.VITE_OFFICE_URL ?? process.env.OFFICE_URL ?? "").replace(
      /\/$/,
      "",
    );

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, title_ru, current_version, updated_at, status, created_by")
      .eq("id", data.document_id)
      .single();
    if (docErr || !doc) throw new Error("Документ не найден");

    const { data: version } = await supabase
      .from("document_versions")
      .select("id, version_no, file_path, file_format")
      .eq("document_id", data.document_id)
      .eq("version_no", doc.current_version)
      .maybeSingle();

    if (!version?.file_path) {
      return {
        available: false as const,
        office_url: officeUrl || null,
        reason: "no_file_version",
      };
    }

    const ext = (version.file_format ?? "docx").toLowerCase();
    const fileType = ext === "doc" ? "doc" : ext === "xlsx" ? "xlsx" : ext === "xls" ? "xls" : "docx";
    const documentType = fileType.startsWith("xls") ? "cell" : "word";

    const signedUrl = await createSignedDownloadUrl(
      supabase,
      STORAGE_BUCKETS.documents,
      version.file_path,
      3600,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name_ru, email")
      .eq("id", userId)
      .maybeSingle();

    const readOnly = !["draft", "returned_for_revision"].includes(doc.status);

    const key = officeDocumentKey(doc.id, version.version_no, doc.updated_at);
    const callbackUrl = `${resolveAppOrigin()}/api/public/hooks/office-callback`;

    return {
      available: true as const,
      office_url: officeUrl || null,
      document_server_url: officeUrl,
      config: {
        document: {
          fileType,
          key,
          title: doc.title_ru,
          url: signedUrl,
        },
        documentType,
        editorConfig: {
          callbackUrl,
          mode: readOnly ? "view" : "edit",
          lang: "ru",
          user: {
            id: userId,
            name: profile?.full_name_ru ?? profile?.email ?? userId,
          },
          customization: {
            forcesave: true,
          },
        },
      },
    };
  });
