// src/components/document-new/types.ts
import type { Json } from "@/integrations/supabase/types";

export interface TemplateField {
  key: string;
  label_ru: string;
  label_kk: string;
  type: "text" | "textarea" | "number" | "date";
  required?: boolean;
  source?: "user" | "author" | "signatory" | "organization" | "system";
}

export interface TemplateSchema {
  fields?: TemplateField[];
  title_template_ru?: string;
  title_template_kk?: string;
}

// Используем Json из Supabase для совместимости с API
export interface Template {
  id: string;
  name_ru: string;
  name_kk: string;
  status: string;
  category: string;
  description: string | null;
  file_format: string;
  file_path: string | null;
  version: number;
  schema: Json; // Используем Json вместо TemplateSchema
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface Nomenclature {
  id: string;
  code: string;
  title_ru: string;
  title_kk: string;
}

export interface DocumentFormValues {
  title_ru: string;
  title_kk: string;
  summary: string;
  body: string;
  nomenclature_id: string;
  document_type_id: string;
  priority_id: string;
  correspondent_id: string;
  registration_journal_id: string;
  delivery_method_id: string;
  received_at: string;
  sent_at: string;
  pages_count: string;
  copies_count: string;
  external_reg_number: string;
  [key: string]: string;
}

export interface RegistrationJournalBrief extends ReferenceBrief {
  prefix?: string | null;
  document_type_id?: string | null;
}

export interface ReferenceBrief {
  id: string;
  code: string;
  name_ru: string;
  name_kk: string;
  bin?: string | null;
  sla_hours?: number | null;
  color?: string | null;
}

// Вспомогательная функция для получения полей из schema
export function getTemplateFields(template: Template | undefined): TemplateField[] {
  if (!template?.schema) return [];

  const schema = template.schema as any;
  if (schema && Array.isArray(schema.fields)) {
    return schema.fields;
  }

  return [];
}
