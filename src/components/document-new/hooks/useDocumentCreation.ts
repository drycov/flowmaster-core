// src/components/document-new/hooks/useDocumentCreation.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createDocument } from "@/lib/api/documents.functions";
import { generateFromTemplate } from "@/lib/api/templates.functions";
import { startWorkflow } from "@/lib/api/workflows.functions";
import { toast } from "sonner";
import type { Template, TemplateField } from "../types";
import type { RouteValue } from "../components/RoutePickerCard";

interface CreateDocumentParams {
  values: Record<string, string>;
  templateId: string | null;
  template?: Template;
  templateFields: TemplateField[];
  route?: RouteValue;
}

interface UseDocumentCreationOptions {
  onSuccess?: (document: any) => void;
  onError?: (error: Error) => void;
  redirectOnSuccess?: boolean;
}

export function useDocumentCreation(options: UseDocumentCreationOptions = {}) {
  const { onSuccess, onError, redirectOnSuccess = true } = options;

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      values,
      templateId,
      template,
      templateFields,
      route,
    }: CreateDocumentParams) => {
      if (!values.title_ru || values.title_ru.trim() === "") {
        throw new Error("Название документа на русском языке обязательно");
      }

      const nomenclatureId =
        values.nomenclature_id && values.nomenclature_id !== "none"
          ? values.nomenclature_id
          : null;

      // Resolve workflow / custom_route from route value
      const tpl = template as any;
      let resolvedWorkflowId: string | null = null;
      let customRouteSteps: any[] | null = null;

      if (route) {
        if (route.kind === "template_default") {
          resolvedWorkflowId = tpl?.default_workflow_id ?? null;
        } else if (route.kind === "workflow") {
          resolvedWorkflowId = route.workflow_id;
        } else if (route.kind === "custom") {
          customRouteSteps = route.steps;
        }
      } else if (tpl?.default_workflow_id) {
        resolvedWorkflowId = tpl.default_workflow_id;
      }

      let created: { id: string; reg_number?: string };

      if (templateId && templateId !== "none" && template) {
        const templateValues: Record<string, string> = {};
        templateFields.forEach((field) => {
          const value = values[field.key];
          if (value && typeof value === "string" && value.trim() !== "") {
            templateValues[field.key] = value;
          } else if (field.required) {
            throw new Error(`Поле "${field.label_ru}" обязательно для заполнения`);
          }
        });

        created = await generateFromTemplate({
          data: {
            template_id: templateId,
            values: templateValues,
            title_ru: values.title_ru,
            title_kk: values.title_kk || null,
            nomenclature_id: nomenclatureId,
          },
        });
      } else {
        created = await createDocument({
          data: {
            title_ru: values.title_ru,
            title_kk: values.title_kk || null,
            summary: values.summary || null,
            body: values.body || null,
            doc_type: "general",
            nomenclature_id: nomenclatureId,
            workflow_id: resolvedWorkflowId,
            custom_route: customRouteSteps as any,
          },
        });
      }

      // Auto-start workflow when a route is configured
      if (created?.id && (resolvedWorkflowId || customRouteSteps)) {
        try {
          await startWorkflow({
            data: {
              document_id: created.id,
              workflow_id: resolvedWorkflowId,
              custom_route: customRouteSteps as any,
            },
          });
        } catch (e) {
          console.error("startWorkflow failed", e);
          toast.warning("Документ создан, но не удалось запустить маршрут");
        }
      }

      return created;
    },
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["wfs"] });

      if (document?.reg_number) {
        toast.success(`Документ зарегистрирован: ${document.reg_number}`, { duration: 5000 });
      } else {
        toast.success("Документ успешно создан");
      }

      onSuccess?.(document);

      if (redirectOnSuccess && document?.id) {
        navigate({ to: "/documents/$id", params: { id: document.id } });
      }
    },
    onError: (error) => {
      console.error("Creation error:", error);
      let errorMessage = "Ошибка при создании документа";
      if (error instanceof Error) errorMessage = error.message;
      toast.error(errorMessage, { duration: 5000 });
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
