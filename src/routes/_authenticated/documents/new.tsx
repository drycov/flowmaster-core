// src/routes/_authenticated/documents/new.tsx

import { useEffect, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";

import { PageHeader, PageBody } from "@/components/AppShell";

import { listTemplates } from "@/lib/api/templates.functions";

import { listNomenclature } from "@/lib/api/nomenclature.functions";



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

import { useI18n } from "@/i18n";
import { resolveDocumentTitles } from "@/lib/templates/document-title";
import { toast } from "sonner";



export const Route = createFileRoute("/_authenticated/documents/new")({

  component: NewDocument,

});



type TemplateWithWorkflow = Template & {

  default_workflow_id?: string | null;

  allow_custom_route?: boolean;

};



function NewDocument() {

  const { t } = useI18n();

  const { data: templates = [], isLoading: templatesLoading } = useQuery({

    queryKey: ["tpls"],

    queryFn: () => listTemplates(),

  });

  const { data: nomenclatures = [], isLoading: nomenclaturesLoading } = useQuery({

    queryKey: ["nom"],

    queryFn: () => listNomenclature(),

  });



  const [selectedTemplateId, setSelectedTemplateId] = useState("none");

  const selectedTemplate = templates.find((tp) => tp.id === selectedTemplateId) as

    | TemplateWithWorkflow

    | undefined;



  const { form, templateFields, authorDefaults } = useDocumentForm({

    templateId: selectedTemplateId,

    template: selectedTemplate,

  });



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



  const { createDocument, isCreating } = useDocumentCreation();



  const handleSubmit = form.handleSubmit(
    (values) => {
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
      });
    },
    (errors) => {
      const entries = Object.entries(errors);
      const first = entries[0]?.[1];
      const fieldName = entries[0]?.[0];
      const message =
        (first && typeof first === "object" && "message" in first
          ? String(first.message)
          : null) ||
        (fieldName ? `${t("doc.formInvalid")}: ${fieldName}` : t("doc.formInvalid"));
      toast.error(message);
    },
  );



  const isLoading = templatesLoading || nomenclaturesLoading;

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

          </EditorPreviewLayout>
        </form>

      </PageBody>

    </>

  );

}

