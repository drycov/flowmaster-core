import { useCallback, useMemo, useState } from "react";
import { buildTemplateEditorPreviewValues } from "@/lib/templates/preview-values";
import { useFilePreview } from "@/lib/templates/use-file-preview";
import type { Field } from "../types";

export function useTemplatePreview(options: {
  filePath: string | null;
  fileFormat: string | null;
  body: string;
  fields: Field[];
  nameRu?: string;
  nameKk?: string;
}) {
  const { filePath, fileFormat, body, fields, nameRu, nameKk } = options;
  const [reloadToken, setReloadToken] = useState(0);

  const previewValues = useMemo(
    () =>
      buildTemplateEditorPreviewValues(fields, {
        name_ru: nameRu,
        name_kk: nameKk,
      }),
    [fields, nameRu, nameKk],
  );

  const result = useFilePreview({
    filePath,
    fileFormat,
    body,
    bucket: "templates",
    substitutePlaceholders: true,
    values: previewValues,
    htmlBody: !filePath && body ? { kind: "editor-labels", body, fields } : null,
    reloadToken,
  });

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  return { ...result, reload };
}
