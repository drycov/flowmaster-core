import { useMemo } from "react";
import { resolveBodyTemplate } from "@/lib/templates/body-template";
import { useFilePreview } from "@/lib/templates/use-file-preview";
import type { DocumentFileVersionRow } from "@/lib/documents/file-version";

export function useDocumentContentPreview(options: {
  body?: string | null;
  fieldValues?: Record<string, string>;
  fileVersion?: DocumentFileVersionRow | null;
}) {
  const { body, fieldValues = {}, fileVersion } = options;
  const bodyText = useMemo(() => resolveBodyTemplate(body), [body]);

  const reloadToken = fileVersion
    ? `${fileVersion.version_no}:${fileVersion.content_hash ?? ""}:${fileVersion.file_path ?? ""}`
    : 0;

  return useFilePreview({
    filePath: fileVersion?.file_path ?? null,
    fileFormat: fileVersion?.file_format ?? null,
    body: bodyText,
    bucket: "documents",
    substitutePlaceholders: false,
    values: fieldValues,
    htmlBody:
      !fileVersion?.file_path && bodyText
        ? { kind: "filled", body: bodyText, values: fieldValues }
        : null,
    debounceMs: 0,
    reloadToken,
  });
}
