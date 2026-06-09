import { useMemo } from "react";
import { buildPreviewTemplateValues } from "@/lib/templates/preview-values";
import { useFilePreview } from "@/lib/templates/use-file-preview";
import type { Template } from "../types";

function getBodyTemplate(template: Template): string {
  const schema = template.schema as { body_template?: string } | null | undefined;
  return schema?.body_template?.trim() ?? "";
}

export function useDocumentPreview(options: {
  template: Template | null | undefined;
  fieldValues: Record<string, string>;
  authorDefaults?: Record<string, string>;
}) {
  const { template, fieldValues, authorDefaults } = options;

  const bodyTemplate = template ? getBodyTemplate(template) : "";
  const previewValues = useMemo(() => {
    if (!template) return {};
    return buildPreviewTemplateValues({
      template: {
        name_ru: template.name_ru,
        name_kk: template.name_kk,
        schema: template.schema as {
          title_template_ru?: string;
          title_template_kk?: string;
        } | null,
      },
      fieldValues,
      authorDefaults,
    });
  }, [template, fieldValues, authorDefaults]);

  return useFilePreview({
    enabled: !!template,
    filePath: template?.file_path ?? null,
    fileFormat: template?.file_format ?? null,
    body: bodyTemplate,
    bucket: "templates",
    substitutePlaceholders: true,
    values: previewValues,
    htmlBody:
      template && !template.file_path && bodyTemplate
        ? { kind: "filled", body: bodyTemplate, values: previewValues }
        : null,
  });
}
