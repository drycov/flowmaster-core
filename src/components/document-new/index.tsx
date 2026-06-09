// src/routes/_authenticated/documents/new.tsx
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
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/documents/new")({
  component: NewDocument,
});

function NewDocument() {
  const { t } = useI18n();

  // Загрузка данных
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["tpls"],
    queryFn: () => listTemplates(),
  });

  const { data: nomenclatures = [], isLoading: nomenclaturesLoading } = useQuery({
    queryKey: ["nom"],
    queryFn: () => listNomenclature(),
  });

  // Форма - важно: вызов хука должен быть всегда, независимо от загрузки
  const formState = useDocumentForm({
    templateId: "none",
    template: undefined, // Пока template не загружен
  });

  const { form, selectedTemplateId, setSelectedTemplateId, templateFields } = formState;

  // Обновляем template в форме когда данные загружены
  const selectedTemplate = templates.find((tp) => tp.id === selectedTemplateId);
  
  // Создание документа
  const { createDocument, isCreating } = useDocumentCreation();

  const handleSubmit = form.handleSubmit((values) => {
    createDocument({
      values,
      templateId: selectedTemplateId,
      template: selectedTemplate,
      templateFields,
    });
  });

  const isLoading = templatesLoading || nomenclaturesLoading;
  const showManualFields = selectedTemplateId === "none";
  const showTemplateFields = selectedTemplate && selectedTemplateId !== "none" && templateFields.length > 0;

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
        <form onSubmit={handleSubmit} className="max-w-3xl space-y-4">
          <MetadataCard
            form={form}
            templateId={selectedTemplateId}
            onTemplateChange={setSelectedTemplateId}
            showManualFields={showManualFields}
            templates={templates}
            nomenclatures={nomenclatures}
            documentTypes={[]}
            priorities={[]}
            correspondents={[]}
            isLoading={isLoading}
          />

          {showTemplateFields && (
            <TemplateFieldsCard form={form} fields={templateFields} />
          )}

          <FormActions isSubmitting={isCreating} />
        </form>
      </PageBody>
    </>
  );
}