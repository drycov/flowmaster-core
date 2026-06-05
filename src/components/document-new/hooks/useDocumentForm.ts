// src/components/document-new/hooks/useDocumentForm.ts
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import type { DocumentFormValues, Template } from "../types";

interface UseDocumentFormProps {
  templateId: string;
  template?: Template;
}

// Вспомогательная функция для извлечения полей из schema
function extractTemplateFields(schema: any): any[] {
  if (!schema) return [];
  if (schema.fields && Array.isArray(schema.fields)) {
    return schema.fields;
  }
  return [];
}

export function useDocumentForm({ templateId, template }: UseDocumentFormProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templateId);
  
  // Безопасное получение полей шаблона
  const templateFields = extractTemplateFields(template?.schema);

  const form = useForm<DocumentFormValues>({
    defaultValues: {
      title_ru: "",
      title_kk: "",
      summary: "",
      body: "",
      nomenclature_id: "none",
    },
  });

  // Динамическая регистрация полей
  useEffect(() => {
    if (templateFields.length > 0) {
      templateFields.forEach((field: any) => {
        if (!form.getValues(field.key as keyof DocumentFormValues)) {
          form.setValue(field.key as keyof DocumentFormValues, "");
        }
      });
    }
  }, [templateFields, form]);

  const getTemplateFieldValues = (): Record<string, string> => {
    const values: Record<string, string> = {};
    templateFields.forEach((field: any) => {
      const value = form.getValues(field.key as keyof DocumentFormValues);
      if (value && typeof value === 'string' && value.trim() !== "") {
        values[field.key] = value;
      }
    });
    return values;
  };

  const resetTemplateFields = () => {
    templateFields.forEach((field: any) => {
      form.setValue(field.key as keyof DocumentFormValues, "");
    });
  };

  useEffect(() => {
    resetTemplateFields();
  }, [selectedTemplateId]);

  return {
    form,
    selectedTemplateId,
    setSelectedTemplateId,
    templateFields,
    getTemplateFieldValues,
    resetTemplateFields,
  };
}