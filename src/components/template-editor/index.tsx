// src/routes/_authenticated/templates/$id.tsx
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

import { useTemplateData } from "@/components/template-editor/hooks/useTemplateData";
import { useTemplateSave } from "@/components/template-editor/hooks/useTemplateSave";
import { MetadataCard } from "@/components/template-editor/components/MetadataCard";
import { BodyTemplateCard } from "@/components/template-editor/components/BodyTemplateCard";
import { FieldsCard } from "@/components/template-editor/components/FieldsCard";

export const Route = createFileRoute("/_authenticated/templates/$id")({
  component: TemplateEditor,
});

function TemplateEditor() {
  const { id } = Route.useParams();
  const { t } = useI18n();

  const {
    nameRu,
    nameKk,
    category,
    status,
    fields,
    body,
    isLoading,
    setNameRu,
    setNameKk,
    setCategory,
    setStatus,
    setFields,
    setBody,
  } = useTemplateData(id);

  const { save, isSaving } = useTemplateSave({
    id,
    nameRu,
    nameKk,
    category,
    status,
    fields,
    body,
  });

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        key: `field_${prev.length + 1}`,
        label_ru: "Новое поле",
        label_kk: "Жаңа өріс",
        type: "text" as const,
        required: false,
      },
    ]);
  };

  const updateField = (index: number, patch: Partial<typeof fields[0]>) => {
    setFields((prev) => prev.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  };

  const deleteField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title={t("nav.templates")} />
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
      <PageHeader
        title={t("nav.templates")}
        actions={
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("wf.draft")}</SelectItem>
                <SelectItem value="published">{t("wf.published")}</SelectItem>
                <SelectItem value="archived">{t("status.archived")}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => save()} disabled={isSaving}>
              {isSaving ? "Сохранение..." : t("common.save")}
            </Button>
          </div>
        }
      />
      
      <PageBody className="grid lg:grid-cols-2 gap-4 max-w-6xl">
        <div className="space-y-4">
          <MetadataCard
            nameRu={nameRu}
            nameKk={nameKk}
            category={category}
            onNameRuChange={setNameRu}
            onNameKkChange={setNameKk}
            onCategoryChange={setCategory}
          />
          
          <BodyTemplateCard body={body} onBodyChange={setBody} />
        </div>
        
        <FieldsCard
          fields={fields}
          onAddField={addField}
          onUpdateField={updateField}
          onDeleteField={deleteField}
        />
      </PageBody>
    </>
  );
}