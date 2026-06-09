import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertTemplate } from "@/lib/api/templates.functions";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import type { TemplateStatus, Field } from "../types";

interface UseTemplateSaveProps {
  id: string;
  nameRu: string;
  nameKk: string;
  category: string;
  description: string;
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
  description,
  status,
  fields,
  body,
  defaultWorkflowId,
  allowCustomRoute,
}: UseTemplateSaveProps) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await upsertTemplate({
        data: {
          id,
          name_ru: nameRu,
          name_kk: nameKk,
          category,
          description: description.trim() || null,
          status,
          schema: { fields, body_template: body },
          default_workflow_id: defaultWorkflowId ?? null,
          allow_custom_route: allowCustomRoute ?? true,
        },
      });

      if (!result?.id) {
        throw new Error(t("tpl.saveFailed"));
      }

      return result;
    },
    onSuccess: () => {
      toast.success(t("tpl.saved"));
      queryClient.invalidateQueries({ queryKey: ["tpl", id] });
      queryClient.invalidateQueries({ queryKey: ["tpls"] });
    },
    onError: (error) => {
      console.error("Save error:", error);
      let errorMessage = t("tpl.saveError");
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
