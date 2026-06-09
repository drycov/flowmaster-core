// src/components/document-new/hooks/useDocumentCreation.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createDocument } from "@/lib/api/documents.functions";
import { generateFromTemplate } from "@/lib/api/templates.functions";
import { startWorkflow } from "@/lib/api/workflows.functions";
import { toast } from "sonner";
import { useI18n, interpolate } from "@/i18n";
import type { Template, TemplateField } from "../types";
import type { RouteValue } from "../components/RoutePickerCard";
import { resolveDocumentTitles } from "@/lib/templates/document-title";
import {
  isAuthorExecutorField,
  isAuthorSignatoryField,
} from "@/lib/templates/author-field-values";
import { buildModifiedDefinition } from "@/lib/workflow/route-builder";
import { getWorkflow } from "@/lib/api/workflows.functions";
import type { WorkflowDefinition } from "@/components/workflow-designer/types";

interface CreateDocumentParams {
  values: Record<string, string>;
  templateId: string | null;
  template?: Template;
  templateFields: TemplateField[];
  authorDefaults?: Record<string, string>;
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
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: async ({
      values,
      templateId,
      template,
      templateFields,
      authorDefaults = {},
      route,
    }: CreateDocumentParams) => {
      let titleRu = values.title_ru?.trim() ?? "";
      let titleKk = values.title_kk?.trim() ?? "";

      if (templateId && templateId !== "none" && template) {
        const titleValues: Record<string, string> = {};
        templateFields.forEach((field) => {
          const value = values[field.key];
          if (value && typeof value === "string" && value.trim() !== "") {
            titleValues[field.key] = value;
          }
        });
        const resolved = resolveDocumentTitles(template, titleValues);
        titleRu = resolved.title_ru;
        titleKk = resolved.title_kk;
      }

      if (!titleRu) {
        throw new Error(t("doc.titleRuRequired"));
      }

      const nomenclatureId =
        values.nomenclature_id && values.nomenclature_id !== "none"
          ? values.nomenclature_id
          : null;

      // Resolve workflow / custom_route from route value
      const tpl = template as any;
      let resolvedWorkflowId: string | null = null;
      let customRouteSteps: any[] | null = null;
      let graphDefinition: WorkflowDefinition | null = null;

      const hasRoute =
        route &&
        route.kind !== "none" &&
        (route.kind !== "custom" || route.steps.length > 0);

      if (route) {
        if (route.kind === "template_default") {
          resolvedWorkflowId = tpl?.default_workflow_id ?? null;
        } else if (route.kind === "workflow") {
          resolvedWorkflowId = route.workflow_id;
        } else if (route.kind === "custom") {
          customRouteSteps = route.steps;
        } else if (route.kind === "modify") {
          const wf = await getWorkflow({ data: { id: route.workflow_id } });
          const base = (wf as { definition: WorkflowDefinition }).definition;
          graphDefinition = buildModifiedDefinition(base, route.overrides);
          resolvedWorkflowId = route.workflow_id;
        }
      } else if (tpl?.default_workflow_id) {
        resolvedWorkflowId = tpl.default_workflow_id;
      }

      let created: { id: string; reg_number?: string };

      if (templateId && templateId !== "none" && template) {
        const templateValues: Record<string, string> = {};
        templateFields.forEach((field) => {
          const value =
            (values[field.key]?.trim() || authorDefaults[field.key]?.trim() || "").trim();
          if (value) {
            templateValues[field.key] = value;
          } else if (
            field.required &&
            !isAuthorExecutorField(field.key) &&
            !isAuthorSignatoryField(field.key)
          ) {
            throw new Error(interpolate(t("doc.fieldRequired"), { field: field.label_ru }));
          }
        });

        created = await generateFromTemplate({
          data: {
            template_id: templateId,
            values: templateValues,
            title_ru: titleRu,
            title_kk: titleKk || null,
            nomenclature_id: nomenclatureId,
            workflow_id: graphDefinition || customRouteSteps ? null : resolvedWorkflowId,
            custom_route: (graphDefinition ?? customRouteSteps) as any,
          },
        });
      } else {
        created = await createDocument({
          data: {
            title_ru: titleRu,
            title_kk: titleKk || null,
            summary: values.summary || null,
            body: values.body || null,
            doc_type: "general",
            nomenclature_id: nomenclatureId,
            workflow_id: graphDefinition || customRouteSteps ? null : resolvedWorkflowId,
            custom_route: (graphDefinition ?? customRouteSteps) as any,
          },
        });
      }

      const shouldStart =
        hasRoute || (!route && resolvedWorkflowId) || customRouteSteps || graphDefinition;

      if (created?.id && shouldStart && (resolvedWorkflowId || customRouteSteps || graphDefinition)) {
        try {
          await startWorkflow({
            data: {
              document_id: created.id,
              workflow_id: resolvedWorkflowId,
              custom_route: (graphDefinition ?? customRouteSteps) as any,
              graph_definition: graphDefinition ?? undefined,
            },
          });
        } catch (workflowErr) {
          console.error("Workflow start failed:", workflowErr);
        }
      }

      return created;
    },
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["wfs"] });

      if (document?.reg_number) {
        toast.success(interpolate(t("doc.registered"), { number: document.reg_number }), {
          duration: 5000,
        });
      } else {
        toast.success(t("doc.created"));
      }

      onSuccess?.(document);

      if (redirectOnSuccess && document?.id) {
        navigate({ to: "/documents/$id", params: { id: document.id } });
      }
    },
    onError: (error) => {
      console.error("Creation error:", error);
      let errorMessage = t("doc.createError");
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
