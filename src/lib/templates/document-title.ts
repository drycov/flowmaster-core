import type { Json } from "@/integrations/supabase/types";

export interface TemplateTitleSource {
  name_ru: string;
  name_kk: string;
  schema?:
    | Json
    | {
        title_template_ru?: string;
        title_template_kk?: string;
      }
    | null;
}

export function substituteTemplateText(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    if (value?.trim()) {
      result = result.replaceAll(`{{${key}}}`, value.trim());
    }
  }
  return result
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveDocumentTitles(
  template: TemplateTitleSource,
  values: Record<string, string>,
): { title_ru: string; title_kk: string } {
  const schema =
    template.schema && typeof template.schema === "object" && !Array.isArray(template.schema)
      ? (template.schema as { title_template_ru?: string; title_template_kk?: string })
      : {};
  const ruTemplate = schema.title_template_ru?.trim() || template.name_ru;
  const kkTemplate =
    schema.title_template_kk?.trim() || template.name_kk?.trim() || template.name_ru;

  const title_ru = substituteTemplateText(ruTemplate, values) || template.name_ru;
  const title_kk =
    substituteTemplateText(kkTemplate, values) || template.name_kk || template.name_ru;

  return { title_ru, title_kk };
}
