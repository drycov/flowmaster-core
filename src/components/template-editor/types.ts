export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "user";
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
  title_template_ru?: string;
  title_template_kk?: string;
}

export type TemplateSyncResult = {
  fields: Field[];
  metadata: {
    name_ru: string;
    name_kk: string;
    description: string | null;
    category: string;
  };
  metadata_updated?: boolean;
};

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
