// src/routes/_authenticated/templates/$id.tsx
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";

import { useTemplateData } from "@/components/template-editor/hooks/useTemplateData";
import { useTemplateSave } from "@/components/template-editor/hooks/useTemplateSave";
import { MetadataCard } from "@/components/template-editor/components/MetadataCard";
import { BodyTemplateCard } from "@/components/template-editor/components/BodyTemplateCard";
import { FieldsCard } from "@/components/template-editor/components/FieldsCard";
import { TemplateFileCard } from "@/components/template-editor/components/TemplateFileCard";
import { TemplatePreviewCard } from "@/components/template-editor/components/TemplatePreviewCard";
import { EditorPreviewLayout } from "@/components/shared/EditorPreviewLayout";
import { listWorkflows } from "@/lib/api/workflows.functions";
import { supportsTemplateProcessing } from "@/lib/templates/file-formats";
import type { TemplateSyncResult } from "@/components/template-editor/types";
import { useTemplateAutoSyncFields } from "@/components/template-editor/hooks/useTemplateAutoSyncFields";

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
    description,
    status,
    fields,
    body,
    defaultWorkflowId,
    allowCustomRoute,
    filePath,
    fileFormat,
    isLoading,
    setNameRu,
    setNameKk,
    setCategory,
    setDescription,
    setStatus,
    setFields,
    setBody,
    setDefaultWorkflowId,
    setAllowCustomRoute,
  } = useTemplateData(id);

  const { save, isSaving } = useTemplateSave({
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
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ["wfs"],
    queryFn: () => listWorkflows(),
  });

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        key: `field_${prev.length + 1}`,
        label_ru: t("tpl.newField"),
        label_kk: t("tpl.newField"),
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

  const handleTemplateSynced = (synced: TemplateSyncResult) => {
    setFields(synced.fields);
    if (synced.metadata_updated) {
      if (synced.metadata.name_ru) setNameRu(synced.metadata.name_ru);
      if (synced.metadata.name_kk) setNameKk(synced.metadata.name_kk);
      if (synced.metadata.description) setDescription(synced.metadata.description);
      if (synced.metadata.category) setCategory(synced.metadata.category);
    }
  };

  const { isSyncing: isAutoSyncingFields } = useTemplateAutoSyncFields({
    templateId: id,
    filePath,
    fileFormat,
    fields,
    isLoading,
    onSynced: handleTemplateSynced,
  });

  const hasFileTemplate = Boolean(filePath && supportsTemplateProcessing(fileFormat));
  const [bodyOpen, setBodyOpen] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      setBodyOpen(!hasFileTemplate);
    }
  }, [isLoading, hasFileTemplate]);

  if (isLoading) {
    return (
      <>
        <PageHeader title={t("nav.templates")} />
        <PageBody>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">{t("tpl.loading")}</div>
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
              {isSaving ? t("tpl.saving") : t("common.save")}
            </Button>
          </div>
        }
      />

      <PageBody>
        <EditorPreviewLayout
          preview={
            <TemplatePreviewCard
              filePath={filePath}
              fileFormat={fileFormat}
              body={body}
              fields={fields}
              nameRu={nameRu}
              nameKk={nameKk}
            />
          }
        >
          <MetadataCard
            nameRu={nameRu}
            nameKk={nameKk}
            category={category}
            description={description}
            onNameRuChange={setNameRu}
            onNameKkChange={setNameKk}
            onCategoryChange={setCategory}
            onDescriptionChange={setDescription}
          />

          <TemplateFileCard
            templateId={id}
            filePath={filePath}
            fileFormat={fileFormat}
            onSynced={handleTemplateSynced}
          />

          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle className="text-sm">{t("tpl.workflowRoute")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>{t("tpl.workflowDefault")}</Label>
                <Select
                  value={defaultWorkflowId ?? "none"}
                  onValueChange={(v) => setDefaultWorkflowId(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("tpl.noWorkflow")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("tpl.noWorkflow")}</SelectItem>
                    {(workflows as any[]).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name_ru} {w.status !== "published" && `(${w.status})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("tpl.workflowHint")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="allow-custom"
                  checked={allowCustomRoute}
                  onCheckedChange={setAllowCustomRoute}
                />
                <Label htmlFor="allow-custom">
                  {t("tpl.allowCustomRoute")}
                </Label>
              </div>
            </CardContent>
          </Card>

          <Collapsible open={bodyOpen} onOpenChange={setBodyOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between px-0">
                <span className="text-sm font-medium">
                  {hasFileTemplate ? t("tpl.fileTemplate.optionalBody") : t("doc.body")}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${bodyOpen ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            {hasFileTemplate && !bodyOpen && (
              <p className="text-xs text-muted-foreground mb-2">{t("tpl.fileTemplate.bodyHint")}</p>
            )}
            <CollapsibleContent>
              <BodyTemplateCard body={body} onBodyChange={setBody} />
            </CollapsibleContent>
          </Collapsible>

          <FieldsCard
            fields={fields}
            onAddField={addField}
            onUpdateField={updateField}
            onDeleteField={deleteField}
            isLoading={isAutoSyncingFields}
          />
        </EditorPreviewLayout>
      </PageBody>
    </>
  );
}
