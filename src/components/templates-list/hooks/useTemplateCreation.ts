import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { upsertTemplate } from "@/lib/api/templates.functions";
import { toast } from "sonner";
import { useI18n, interpolate } from "@/i18n";

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
}

export function useTemplateCreation(options: UseTemplateCreationOptions = {}) {
  const { onSuccess, onError, redirectOnSuccess = true } = options;
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const defaultName = { ru: t("tpl.defaultName"), kk: t("tpl.defaultNameKk") };

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
            body_template: t("tpl.defaultBody"),
          },
        },
      });

      if (!result?.id) {
        throw new Error(t("tpl.createFailed"));
      }

      return result as Template;
    },
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ["tpls"] });

      toast.success(interpolate(t("tpl.created"), { name: template.name_ru }), {
        action: {
          label: t("tpl.editAction"),
          onClick: () => {
            if (template?.id) {
              navigate({ to: "/templates/$id", params: { id: template.id } });
            }
          },
        },
      });

      onSuccess?.(template);

      if (redirectOnSuccess && template?.id) {
        navigate({ to: "/templates/$id", params: { id: template.id } });
      }
    },
    onError: (error) => {
      let errorMessage = t("tpl.createError");
      if (error instanceof Error) {
        if (error.message.includes("permission")) {
          errorMessage = t("tpl.createForbidden");
        } else if (error.message.includes("network")) {
          errorMessage = t("tpl.createNetworkError");
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
    isCreating: mutation.isPending,
  };
}
