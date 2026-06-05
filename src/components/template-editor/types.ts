export type FieldType = "text" | "textarea" | "number" | "date";
export type TemplateStatus = "draft" | "published" | "archived";

export interface Field {
  key: string;
  label_ru: string;
  label_kk: string;
  type: FieldType;
  required?: boolean;
}

export interface TemplateSchema {
  fields?: Field[];
  body_template?: string;
}

export interface Template {
  id: string;
  name_ru: string;
  name_kk: string;
  category: string;
  status: TemplateStatus;
  version: number;
  schema: TemplateSchema;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  description?: string | null;
  file_format?: string;
  file_path?: string | null;
}