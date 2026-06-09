import { useMemo } from "react";
import { resolveBodyTemplate } from "@/lib/templates/body-template";
import { useFilePreview } from "@/lib/templates/use-file-preview";
import type { DocumentVersion } from "../types";

export function useDocumentContentPreview(options: {
  body?: string | null;
  fieldValues?: Record<string, string>;
  currentVersion?: DocumentVersion | null;
}) {
  const { body, fieldValues = {}, currentVersion } = options;
  const bodyText = useMemo(() => resolveBodyTemplate(body), [body]);

  return useFilePreview({
    filePath: currentVersion?.file_path ?? null,
    fileFormat: currentVersion?.file_format ?? null,
    body: bodyText,
    bucket: "documents",
    substitutePlaceholders: false,
    values: fieldValues,
    htmlBody:
      !currentVersion?.file_path && bodyText
        ? { kind: "filled", body: bodyText, values: fieldValues }
        : null,
    debounceMs: 0,
  });
}
