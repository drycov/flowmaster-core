// src/components/document-new/utils/transformers.ts
import type { Json } from "@/integrations/supabase/types";
import type { Template, TemplateField } from "../types";

// Функция для безопасного получения полей из Json
export function extractTemplateFields(schema: Json | null | undefined): TemplateField[] {
  if (!schema) return [];

  try {
    // Проверяем, что schema - это объект с полем fields
    const schemaObj = schema as Record<string, unknown>;
    if (schemaObj.fields && Array.isArray(schemaObj.fields)) {
      return schemaObj.fields as TemplateField[];
    }
  } catch (error) {
    console.error("Error extracting template fields:", error);
  }

  return [];
}

// Трансформер для шаблона из API
export function transformTemplate(apiTemplate: any): Template {
  return {
    ...apiTemplate,
    // Оставляем schema как есть, но добавляем helper
    _fields: extractTemplateFields(apiTemplate.schema),
  };
}

// Хелпер для получения полей из шаблона
export function getTemplateFields(template: Template | undefined): TemplateField[] {
  if (!template) return [];
  return extractTemplateFields(template.schema);
}
