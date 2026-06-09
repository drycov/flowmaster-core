// src/components/templates-list/utils/transformers.ts
import type { Json } from "@/integrations/supabase/types";
import type { Template } from "../types";

export function transformTemplate(apiTemplate: any): Template {
  return {
    id: apiTemplate.id,
    name_ru: apiTemplate.name_ru,
    name_kk: apiTemplate.name_kk,
    category: apiTemplate.category,
    status: apiTemplate.status, // string совместим с TemplateStatus
    version: apiTemplate.version,
    schema: apiTemplate.schema,
    created_at: apiTemplate.created_at,
    updated_at: apiTemplate.updated_at,
    created_by: apiTemplate.created_by,
    description: apiTemplate.description,
    file_format: apiTemplate.file_format,
    file_path: apiTemplate.file_path,
  };
}

export function transformTemplates(apiTemplates: any[]): Template[] {
  return apiTemplates.map(transformTemplate);
}
