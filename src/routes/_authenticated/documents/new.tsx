// src/routes/_authenticated/documents/new.tsx
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, PageBody } from "@/components/AppShell";
import { listTemplates } from "@/lib/api/templates.functions";
import { listNomenclature } from "@/lib/api/nomenclature.functions";

import { useDocumentForm } from "@/components/document-new/hooks/useDocumentForm";
import { useDocumentCreation } from "@/components/document-new/hooks/useDocumentCreation";
import { MetadataCard } from "@/components/document-new/components/MetadataCard";
import { TemplateFieldsCard } from "@/components/document-new/components/TemplateFieldsCard";
import { FormActions } from "@/components/document-new/components/FormActions";
import {
  RoutePickerCard,
  type RouteValue,
} from "@/components/document-new/components/RoutePickerCard";

export const Route = createFileRoute("/_authenticated/documents/new")({
  component: NewDocument,
});

function NewDocument() {
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["tpls"],
    queryFn: () => listTemplates(),
  });
  const { data: nomenclatures = [], isLoading: nomenclaturesLoading } = useQuery({
    queryKey: ["nom"],
    queryFn: () => listNomenclature(),
  });

  const formState = useDocumentForm({ templateId: "none", template: undefined });
  const { form, selectedTemplateId, setSelectedTemplateId, templateFields } = formState;

  const selectedTemplate = templates.find((tp) => tp.id === selectedTemplateId) as any;
  const templateDefaultWf = selectedTemplate?.default_workflow_id ?? null;
  const templateAllowCustom = selectedTemplate?.allow_custom_route ?? true;

  const [route, setRoute] = useState<RouteValue>({ kind: "none" });

  const { createDocument, isCreating } = useDocumentCreation();

  const handleSubmit = form.handleSubmit((values) => {
    createDocument({
      values: values as any,
      templateId: selectedTemplateId,
      template: selectedTemplate,
      templateFields,
      route,
    });
  });

  const isLoading = templatesLoading || nomenclaturesLoading;
  const showManualFields = selectedTemplateId === "none";
  const showTemplateFields =
    selectedTemplate && selectedTemplateId !== "none" && templateFields.length > 0;

  if (isLoading) {
    return (
      <>
        <PageHeader title="Создание документа" />
        <PageBody>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Загрузка...</div>
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Создание документа" />
      <PageBody>
        <form onSubmit={handleSubmit} className="max-w-3xl space-y-4">
          <MetadataCard
            form={form}
            templateId={selectedTemplateId}
            onTemplateChange={setSelectedTemplateId}
            showManualFields={showManualFields}
            templates={templates}
            nomenclatures={nomenclatures}
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
        </form>
      </PageBody>
    </>
  );
}
