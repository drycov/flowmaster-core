import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertTemplate } from "@/lib/api/templates.functions";
import { toast } from "sonner";
import type { TemplateStatus, Field } from "../types";

interface UseTemplateSaveProps {
  id: string;
  nameRu: string;
  nameKk: string;
  category: string;
  status: TemplateStatus;
  fields: Field[];
  body: string;
  defaultWorkflowId?: string | null;
  allowCustomRoute?: boolean;
}

export function useTemplateSave({
  id,
  nameRu,
  nameKk,
  category,
  status,
  fields,
  body,
  defaultWorkflowId,
  allowCustomRoute,
}: UseTemplateSaveProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await upsertTemplate({
        data: {
          id,
          name_ru: nameRu,
          name_kk: nameKk,
          category,
          status,
          schema: { fields, body_template: body },
          default_workflow_id: defaultWorkflowId ?? null,
          allow_custom_route: allowCustomRoute ?? true,
        },
      });

      if (!result?.id) {
        throw new Error("Не удалось сохранить шаблон");
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Шаблон сохранён");
      queryClient.invalidateQueries({ queryKey: ["tpl", id] });
      queryClient.invalidateQueries({ queryKey: ["tpls"] });
    },
    onError: (error) => {
      console.error("Save error:", error);
      let errorMessage = "Ошибка при сохранении шаблона";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    },
  });

  return {
    save: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
