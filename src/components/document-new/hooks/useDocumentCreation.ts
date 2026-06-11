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
  isAutoFilledTemplateField,
} from "@/lib/templates/template-field-source";
import { buildModifiedDefinition } from "@/lib/workflow/route-builder";
import { getWorkflow } from "@/lib/api/workflows.functions";
import type { WorkflowDefinition } from "@/components/workflow-designer/types";
import { toGraphRouteInput } from "@/lib/workflow/route-builder";
import { uploadDocumentAttachments } from "@/lib/documents/upload-attachments.client";
import { formatAttachmentsListText } from "@/lib/documents/attachments-format";

interface CreateDocumentParams {
  values: Record<string, string>;
  templateId: string | null;
  template?: Template;
  templateFields: TemplateField[];
  authorDefaults?: Record<string, string>;
  route?: RouteValue;
  projectId?: string | null;
  attachmentFiles?: File[];
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
      projectId,
      attachmentFiles = [],
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
        values.nomenclature_id && values.nomenclature_id !== "none" ? values.nomenclature_id : null;

      const documentTypeId = values.document_type_id?.trim() || null;
      const priorityId = values.priority_id?.trim() || null;
      const correspondentId = values.correspondent_id?.trim() || null;
      const registrationJournalId = values.registration_journal_id?.trim() || null;
      const deliveryMethodId = values.delivery_method_id?.trim() || null;
      const receivedAt = values.received_at?.trim()
        ? new Date(values.received_at).toISOString()
        : null;
      const sentAt = values.sent_at?.trim() ? new Date(values.sent_at).toISOString() : null;
      const pagesCount = values.pages_count?.trim() ? Number(values.pages_count) : null;
      const copiesCount = values.copies_count?.trim() ? Number(values.copies_count) : null;
      const externalRegNumber = values.external_reg_number?.trim() || null;

      const correspondenceFields = {
        registration_journal_id: registrationJournalId,
        delivery_method_id: deliveryMethodId,
        received_at: receivedAt,
        sent_at: sentAt,
        pages_count: Number.isFinite(pagesCount) ? pagesCount : null,
        copies_count: Number.isFinite(copiesCount) ? copiesCount : null,
        external_reg_number: externalRegNumber,
      };

      // Resolve workflow / custom_route from route value
      const tpl = template as any;
      let resolvedWorkflowId: string | null = null;
      let customRouteSteps: any[] | null = null;
      let graphDefinition: WorkflowDefinition | null = null;

      const hasRoute =
        route && route.kind !== "none" && (route.kind !== "custom" || route.steps.length > 0);

      if (route) {
        if (route.kind === "template_default") {
          resolvedWorkflowId = tpl?.default_workflow_id ?? null;
        } else if (route.kind === "workflow") {
          resolvedWorkflowId = route.workflow_id;
        } else if (route.kind === "custom") {
          customRouteSteps = route.steps;
        } else if (route.kind === "modify") {
          const wf = await getWorkflow({ data: { id: route.workflow_id } });
          const base = (wf as unknown as { definition: WorkflowDefinition }).definition;
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
          const value = (
            values[field.key]?.trim() ||
            authorDefaults[field.key]?.trim() ||
            ""
          ).trim();
          if (value) {
            templateValues[field.key] = value;
          } else if (field.required && !isAutoFilledTemplateField(field)) {
            throw new Error(interpolate(t("doc.fieldRequired"), { field: field.label_ru }));
          }
        });

        if (attachmentFiles.length > 0 && templateFields.some((f) => f.key === "attachments")) {
          templateValues.attachments =
            templateValues.attachments ||
            formatAttachmentsListText(attachmentFiles.map((f) => ({ name: f.name })));
        }

        created = await generateFromTemplate({
          data: {
            template_id: templateId,
            values: templateValues,
            title_ru: titleRu,
            title_kk: titleKk || null,
            nomenclature_id: nomenclatureId,
            document_type_id: documentTypeId,
            priority_id: priorityId,
            correspondent_id: correspondentId,
            ...correspondenceFields,
            workflow_id: graphDefinition || customRouteSteps ? null : resolvedWorkflowId,
            custom_route: (graphDefinition ?? customRouteSteps) as any,
            project_id: projectId ?? null,
          },
        });
      } else {
        created = await createDocument({
          data: {
            title_ru: titleRu,
            title_kk: titleKk || null,
            summary: values.summary || null,
            body: values.body || null,
            nomenclature_id: nomenclatureId,
            document_type_id: documentTypeId,
            priority_id: priorityId,
            correspondent_id: correspondentId,
            ...correspondenceFields,
            workflow_id: graphDefinition || customRouteSteps ? null : resolvedWorkflowId,
            custom_route: (graphDefinition ?? customRouteSteps) as any,
            project_id: projectId ?? null,
          },
        });
      }

      if (created?.id && attachmentFiles.length > 0) {
        await uploadDocumentAttachments(created.id, attachmentFiles);
      }

      const shouldStart =
        hasRoute || (!route && resolvedWorkflowId) || customRouteSteps || graphDefinition;

      if (
        created?.id &&
        shouldStart &&
        (resolvedWorkflowId || customRouteSteps || graphDefinition)
      ) {
        try {
          await startWorkflow({
            data: {
              document_id: created.id,
              workflow_id: resolvedWorkflowId,
              custom_route: (graphDefinition ?? customRouteSteps) as any,
              graph_definition: toGraphRouteInput(graphDefinition) ?? undefined,
            },
          });
        } catch (workflowErr) {
          const message =
            workflowErr instanceof Error ? workflowErr.message : "Не удалось запустить маршрут";
          toast.error(message);
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

      if (document?.approval_sheet_id) {
        toast.info(t("doc.approvalSheetCreated"), { duration: 4000 });
      }

      queryClient.invalidateQueries({ queryKey: ["document-attachments"] });

      onSuccess?.(document);

      if (redirectOnSuccess && document?.id) {
        navigate({ to: "/documents/$id", params: { id: document.id } });
      }
    },
    onError: (error) => {
      console.error("Creation error:", error);
      const raw = error instanceof Error ? error.message : String(error);
      const isStampTriggerBug =
        /source_document_id|stamp_organization_from_document/i.test(raw);
      const errorMessage = isStampTriggerBug ? t("doc.createErrorDbTrigger") : raw || t("doc.createError");
      toast.error(errorMessage, { duration: isStampTriggerBug ? 12000 : 5000 });
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
