// src/components/document-new/hooks/useDocumentCreation.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createDocument } from "@/lib/api/documents.functions";
import { generateFromTemplate } from "@/lib/api/templates.functions";
import { toast } from "sonner";
import type { Template, TemplateField } from "../types";

interface CreateDocumentParams {
  values: Record<string, string>;
  templateId: string | null;
  template?: Template;
  templateFields: TemplateField[];
}

interface UseDocumentCreationOptions {
  onSuccess?: (document: any) => void;
  onError?: (error: Error) => void;
  redirectOnSuccess?: boolean;
}

export function useDocumentCreation(options: UseDocumentCreationOptions = {}) {
  const {
    onSuccess,
    onError,
    redirectOnSuccess = true,
  } = options;
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ values, templateId, template, templateFields }: CreateDocumentParams) => {
      // Валидация обязательных полей
      if (!values.title_ru || values.title_ru.trim() === "") {
        throw new Error("Название документа на русском языке обязательно");
      }

      const nomenclatureId = values.nomenclature_id && values.nomenclature_id !== "none" 
        ? values.nomenclature_id 
        : null;

      // Создание из шаблона
      if (templateId && templateId !== "none" && template) {
        const templateValues: Record<string, string> = {};
        templateFields.forEach((field) => {
          const value = values[field.key];
          if (value && typeof value === 'string' && value.trim() !== "") {
            templateValues[field.key] = value;
          } else if (field.required) {
            throw new Error(`Поле "${field.label_ru}" обязательно для заполнения`);
          }
        });

        const result = await generateFromTemplate({
          data: {
            template_id: templateId,
            values: templateValues,
            title_ru: values.title_ru,
            title_kk: values.title_kk || null,
            nomenclature_id: nomenclatureId,
          },
        });

        return result;
      }

      // Обычное создание документа
      const result = await createDocument({
        data: {
          title_ru: values.title_ru,
          title_kk: values.title_kk || null,
          summary: values.summary || null,
          body: values.body || null,
          doc_type: "general",
          nomenclature_id: nomenclatureId,
        },
      });

      return result;
    },
    onSuccess: (document) => {
      // Инвалидируем связанные запросы
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["wfs"] });
      
      // Показываем уведомление
      if (document?.reg_number) {
        toast.success(`Документ зарегистрирован: ${document.reg_number}`, {
          duration: 5000,
          action: {
            label: "Открыть",
            onClick: () => {
              if (document?.id) {
                navigate({ to: "/documents/$id", params: { id: document.id } });
              }
            },
          },
        });
      } else {
        toast.success("Документ успешно создан");
      }
      
      // Вызываем пользовательский обработчик
      onSuccess?.(document);
      
      // Редирект на страницу документа
      if (redirectOnSuccess && document?.id) {
        navigate({ 
          to: "/documents/$id", 
          params: { id: document.id } 
        });
      }
    },
    onError: (error) => {
      console.error("Creation error:", error);
      
      let errorMessage = "Ошибка при создании документа";
      if (error instanceof Error) {
        if (error.message.includes("required")) {
          errorMessage = error.message;
        } else if (error.message.includes("network")) {
          errorMessage = "Ошибка сети. Проверьте подключение к интернету";
        } else if (error.message.includes("permission")) {
          errorMessage = "У вас нет прав для создания документа";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage, {
        duration: 5000,
      });
      
      onError?.(error as Error);
    },
  });

  return {
    createDocument: mutation.mutate,
    isCreating: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}