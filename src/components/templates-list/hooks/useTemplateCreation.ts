// src/components/templates-list/hooks/useTemplateCreation.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { upsertTemplate } from "@/lib/api/templates.functions";
import { toast } from "sonner";

// Добавляем тип для шаблона
interface Template {
  id: string;
  name_ru: string;
  name_kk: string;
  category: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface UseTemplateCreationOptions {
  onSuccess?: (template: Template) => void;
  onError?: (error: Error) => void;
  redirectOnSuccess?: boolean;
  defaultName?: {
    ru: string;
    kk: string;
  };
}

export function useTemplateCreation(options: UseTemplateCreationOptions = {}) {
  const {
    onSuccess,
    onError,
    redirectOnSuccess = true,
    defaultName = { ru: "Новый шаблон", kk: "Жаңа үлгі" },
  } = options;
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (): Promise<Template> => {
      const result = await upsertTemplate({
        data: {
          name_ru: defaultName.ru,
          name_kk: defaultName.kk,
          category: "general",
          status: "draft",
          schema: { 
            fields: [], 
            body_template: "Документ\n\n{{поле1}}\n" 
          },
        },
      });
      
      if (!result?.id) {
        throw new Error("Не удалось создать шаблон");
      }
      
      // Приводим результат к нужному типу
      return result as Template;
    },
    onSuccess: (template) => {
      // Инвалидируем кэш
      queryClient.invalidateQueries({ queryKey: ["tpls"] });
      
      // Показываем уведомление
      toast.success(`Шаблон "${template.name_ru}" создан`, {
        action: {
          label: "Редактировать",
          onClick: () => {
            if (template?.id) {
              navigate({ to: "/templates/$id", params: { id: template.id } });
            }
          },
        },
      });
      
      // Вызываем пользовательский обработчик
      onSuccess?.(template);
      
      // Редирект на страницу редактирования
      if (redirectOnSuccess && template?.id) {
        navigate({ to: "/templates/$id", params: { id: template.id } });
      }
    },
    onError: (error) => {
      console.error("Template creation error:", error);
      
      let errorMessage = "Ошибка при создании шаблона";
      if (error instanceof Error) {
        if (error.message.includes("permission")) {
          errorMessage = "У вас нет прав для создания шаблонов";
        } else if (error.message.includes("network")) {
          errorMessage = "Ошибка сети. Проверьте подключение";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      onError?.(error as Error);
    },
  });

  return {
    createTemplate: mutation.mutate,
    createTemplateAsync: mutation.mutateAsync,
    isCreating: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}