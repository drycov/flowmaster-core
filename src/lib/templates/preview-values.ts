import { resolveDocumentTitles } from "./document-title";
import { harmonizeTemplateSubstitutionValues } from "./preset-fields";

export type TemplateEditorField = {
  key: string;
  label_ru: string;
};

/** Sample values for template editor preview (field labels as placeholders). */
export function buildTemplateEditorPreviewValues(
  fields: TemplateEditorField[],
  names?: { name_ru?: string; name_kk?: string },
): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10);
  const titleRu = names?.name_ru?.trim() || "Название документа";
  const titleKk = names?.name_kk?.trim() || titleRu;

  const values: Record<string, string> = {
    document_title: titleRu,
    title_ru: titleRu,
    title_kk: titleKk,
    document_date: today,
  };

  for (const field of fields) {
    if (field.key?.trim()) {
      values[field.key] = field.label_ru?.trim() || field.key;
    }
  }

  return harmonizeTemplateSubstitutionValues({
    ...values,
    document_number: "000000000001",
    registration_number: "000000000001",
    reg_number: "000000000001",
  });
}

export function buildPreviewTemplateValues(options: {
  template: {
    name_ru: string;
    name_kk: string;
    schema?: {
      title_template_ru?: string;
      title_template_kk?: string;
    } | null;
  };
  fieldValues: Record<string, string>;
  authorDefaults?: Record<string, string>;
}): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10);
  const merged = { ...(options.authorDefaults ?? {}), ...options.fieldValues };
  const titles = resolveDocumentTitles(options.template, merged);
  const subject = merged.document_subject?.trim() || titles.title_ru;

  return harmonizeTemplateSubstitutionValues({
    ...merged,
    document_title: titles.title_ru,
    title_ru: titles.title_ru,
    title_kk: titles.title_kk,
    document_date: today,
    document_number: "000000000001",
    registration_number: "000000000001",
    reg_number: "000000000001",
    document_subject: subject,
  });
}
