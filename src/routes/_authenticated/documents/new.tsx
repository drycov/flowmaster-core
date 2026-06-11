// src/routes/_authenticated/documents/new.tsx

import { useEffect, useMemo, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";

import { useQuery } from "@tanstack/react-query";

import { PageHeader, PageBody } from "@/components/AppShell";

import { listTemplates } from "@/lib/api/templates.functions";

import { listNomenclature } from "@/lib/api/nomenclature.functions";
import {
  listCorrespondentsBrief,
  listDeliveryMethodsBrief,
  listDocumentTypesBrief,
  listPrioritiesBrief,
  listRegistrationJournalsBrief,
} from "@/lib/api/references.functions";

import { useDocumentForm } from "@/components/document-new/hooks/useDocumentForm";

import { useDocumentCreation } from "@/components/document-new/hooks/useDocumentCreation";

import { MetadataCard } from "@/components/document-new/components/MetadataCard";

import { TemplateFieldsCard } from "@/components/document-new/components/TemplateFieldsCard";
import { DocumentPreviewCard } from "@/components/document-new/components/DocumentPreviewCard";
import { EditorPreviewLayout } from "@/components/shared/EditorPreviewLayout";

import { FormActions } from "@/components/document-new/components/FormActions";

import {
  RoutePickerCard,
  type RouteValue,
} from "@/components/document-new/components/RoutePickerCard";

import type { Template } from "@/components/document-new/types";

import { useI18n, interpolate } from "@/i18n";
import { resolveDocumentTitles } from "@/lib/templates/document-title";
import {
  getDocumentTypeFormProfile,
  hiddenMetadataFields,
  resolveDocumentTypeCode,
  validateDocumentFormByType,
} from "@/lib/documents/document-type-form";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents/new")({
  beforeLoad: () => requireModule("documents", "write"),
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: (search.projectId as string) || undefined,
    templateId: (search.templateId as string) || undefined,
    nomenclatureId: (search.nomenclatureId as string) || undefined,
    departmentId: (search.departmentId as string) || undefined,
    documentTypeCode: (search.documentTypeCode as string) || undefined,
  }),
  component: NewDocument,
});

type TemplateWithWorkflow = Template & {
  default_workflow_id?: string | null;

  allow_custom_route?: boolean;
};

function NewDocument() {
  const { t } = useI18n();
  const { projectId, templateId, nomenclatureId, documentTypeCode } = Route.useSearch();

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["tpls"],

    queryFn: () => listTemplates(),
  });

  const { data: nomenclatures = [], isLoading: nomenclaturesLoading } = useQuery({
    queryKey: ["nom"],
    queryFn: () => listNomenclature(),
  });

  const { data: documentTypes = [], isLoading: documentTypesLoading } = useQuery({
    queryKey: ["ref-document-types-brief"],
    queryFn: listDocumentTypesBrief,
  });

  const { data: priorities = [], isLoading: prioritiesLoading } = useQuery({
    queryKey: ["ref-priorities-brief"],
    queryFn: listPrioritiesBrief,
  });

  const { data: correspondents = [], isLoading: correspondentsLoading } = useQuery({
    queryKey: ["ref-correspondents-brief"],
    queryFn: listCorrespondentsBrief,
  });

  const { data: registrationJournals = [], isLoading: journalsLoading } = useQuery({
    queryKey: ["ref-registration-journals-brief"],
    queryFn: listRegistrationJournalsBrief,
  });

  const { data: deliveryMethods = [], isLoading: deliveryMethodsLoading } = useQuery({
    queryKey: ["ref-delivery-methods-brief"],
    queryFn: listDeliveryMethodsBrief,
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState(templateId ?? "none");

  useEffect(() => {
    if (templateId) setSelectedTemplateId(templateId);
  }, [templateId]);

  const selectedTemplate = templates.find((tp) => tp.id === selectedTemplateId) as
    | TemplateWithWorkflow
    | undefined;

  const { form, templateFields, authorDefaults } = useDocumentForm({
    templateId: selectedTemplateId,

    template: selectedTemplate,
  });

  useEffect(() => {
    if (nomenclatureId) form.setValue("nomenclature_id", nomenclatureId);
  }, [nomenclatureId, form]);

  const templateDefaultWf = selectedTemplate?.default_workflow_id ?? null;

  const templateAllowCustom = selectedTemplate?.allow_custom_route ?? true;

  const [route, setRoute] = useState<RouteValue>({ kind: "none" });

  useEffect(() => {
    if (templateDefaultWf) {
      setRoute({ kind: "template_default" });
    } else {
      setRoute({ kind: "none" });
    }
  }, [selectedTemplateId, templateDefaultWf]);

  useEffect(() => {
    if (!priorities.length || form.getValues("priority_id")) return;
    const normal = priorities.find((p) => p.code === "normal");
    if (normal) form.setValue("priority_id", normal.id);
  }, [priorities, form]);

  useEffect(() => {
    if (!selectedTemplate?.category || !documentTypes.length) return;
    const match = documentTypes.find((dt) => dt.code === selectedTemplate.category);
    if (match) form.setValue("document_type_id", match.id);
  }, [selectedTemplateId, selectedTemplate?.category, documentTypes, form]);

  const documentTypeId = form.watch("document_type_id");

  const documentTypeCodeResolved = useMemo(
    () => resolveDocumentTypeCode(documentTypeId, documentTypes),
    [documentTypeId, documentTypes],
  );

  const formProfile = useMemo(
    () => getDocumentTypeFormProfile(documentTypeCodeResolved),
    [documentTypeCodeResolved],
  );

  const filteredTemplates = useMemo(() => {
    if (!documentTypeCodeResolved) return templates;
    return templates.filter(
      (tp) =>
        !tp.category ||
        tp.category === "general" ||
        tp.category === documentTypeCodeResolved,
    );
  }, [templates, documentTypeCodeResolved]);

  useEffect(() => {
    if (!documentTypeCode || !documentTypes.length) return;
    const match = documentTypes.find((dt) => dt.code === documentTypeCode);
    if (match) form.setValue("document_type_id", match.id);
  }, [documentTypeCode, documentTypes, form]);

  useEffect(() => {
    if (selectedTemplateId === "none") return;
    if (!filteredTemplates.some((tp) => tp.id === selectedTemplateId)) {
      setSelectedTemplateId("none");
    }
  }, [filteredTemplates, selectedTemplateId]);

  useEffect(() => {
    for (const field of hiddenMetadataFields(formProfile)) {
      form.setValue(field, "");
    }
  }, [formProfile, form]);

  useEffect(() => {
    if (!documentTypeId || !registrationJournals.length) return;
    const journal = registrationJournals.find((j) => j.document_type_id === documentTypeId);
    if (journal) form.setValue("registration_journal_id", journal.id);
  }, [documentTypeId, registrationJournals, form]);

  const { createDocument, isCreating } = useDocumentCreation();

  const handleSubmit = form.handleSubmit(
    (values) => {
      const missingLabel = validateDocumentFormByType(values, formProfile, {
        correspondent_id: t("doc.correspondent"),
        received_at: t("doc.receivedAt"),
        sent_at: t("doc.sentAt"),
      });
      if (missingLabel) {
        toast.error(interpolate(t("doc.fieldRequired"), { field: missingLabel }));
        return;
      }

      if (!values.document_type_id?.trim()) {
        toast.error(t("doc.documentTypeRequired"));
        return;
      }

      const payload = { ...values } as Record<string, string>;

      if (selectedTemplateId !== "none" && selectedTemplate) {
        const fieldValues: Record<string, string> = { ...authorDefaults };
        templateFields.forEach((field) => {
          const raw = values[field.key as keyof typeof values];
          if (typeof raw === "string" && raw.trim()) {
            fieldValues[field.key] = raw.trim();
          }
        });
        const titles = resolveDocumentTitles(selectedTemplate, fieldValues);
        payload.title_ru = titles.title_ru;
        payload.title_kk = titles.title_kk;
      }

      createDocument({
        values: payload,
        templateId: selectedTemplateId,
        template: selectedTemplate,
        templateFields,
        authorDefaults,
        route,
        projectId: projectId ?? null,
      });
    },
    (errors) => {
      const entries = Object.entries(errors);
      const first = entries[0]?.[1];
      const fieldName = entries[0]?.[0];
      const message =
        (first && typeof first === "object" && "message" in first ? String(first.message) : null) ||
        (fieldName ? `${t("doc.formInvalid")}: ${fieldName}` : t("doc.formInvalid"));
      toast.error(message);
    },
  );

  const isLoading =
    templatesLoading ||
    nomenclaturesLoading ||
    documentTypesLoading ||
    prioritiesLoading ||
    correspondentsLoading ||
    journalsLoading ||
    deliveryMethodsLoading;

  const showManualFields = selectedTemplateId === "none";

  const showTemplateFields = selectedTemplateId !== "none" && templateFields.length > 0;

  const showDocumentPreview = selectedTemplateId !== "none" && !!selectedTemplate;

  if (isLoading) {
    return (
      <>
        <PageHeader title={t("doc.creating")} />

        <PageBody>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">{t("doc.creatingLoading")}</div>
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("doc.creating")} />

      <PageBody>
        <form onSubmit={handleSubmit}>
          <EditorPreviewLayout
            showPreview={showDocumentPreview}
            preview={
              selectedTemplate ? (
                <DocumentPreviewCard
                  template={selectedTemplate}
                  form={form}
                  templateFields={templateFields}
                  authorDefaults={authorDefaults}
                />
              ) : null
            }
          >
            <MetadataCard
              form={form}
              templateId={selectedTemplateId}
              onTemplateChange={setSelectedTemplateId}
              showManualFields={showManualFields}
              formProfile={formProfile}
              documentTypeSelected={!!documentTypeId}
              templates={filteredTemplates}
              nomenclatures={nomenclatures}
              documentTypes={documentTypes}
              priorities={priorities}
              correspondents={correspondents}
              registrationJournals={registrationJournals}
              deliveryMethods={deliveryMethods}
              isLoading={isLoading}
            />

            {showTemplateFields && <TemplateFieldsCard form={form} fields={templateFields} />}

            <RoutePickerCard
              templateDefaultWorkflowId={templateDefaultWf}
              templateAllowCustom={templateAllowCustom}
              value={route}
              onChange={setRoute}
            />

            <FormActions isSubmitting={isCreating} />
          </EditorPreviewLayout>
        </form>
      </PageBody>
    </>
  );
}
