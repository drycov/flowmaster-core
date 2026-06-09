// src/routes/_authenticated/templates/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useI18n } from "@/i18n";
import { listTemplates } from "@/lib/api/templates.functions";
import { listTemplateCategoriesBrief } from "@/lib/api/references.functions";
import type { ReferenceCodeOption } from "@/components/references/ReferenceCodeSelect";

import { useTemplateCreation } from "@/components/templates-list/hooks/useTemplateCreation";
import { TemplateGrid } from "@/components/templates-list/components/TemplateGrid";

export const Route = createFileRoute("/_authenticated/templates/")({
  beforeLoad: () => requireModule("templates"),
  component: TemplatesList,
});

function TemplatesList() {
  const { t } = useI18n();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["tpls"],
    queryFn: () => listTemplates(),
  });

  const { data: categories = [] } = useQuery<ReferenceCodeOption[]>({
    queryKey: ["ref-template-categories"],
    queryFn: () => listTemplateCategoriesBrief() as Promise<ReferenceCodeOption[]>,
  });

  const { createTemplate, isCreating } = useTemplateCreation();

  // Трансформируем данные для компонентов (если нужно)
  const normalizedTemplates =
    templates?.map((template) => ({
      id: template.id,
      name_ru: template.name_ru,
      name_kk: template.name_kk,
      category: template.category,
      status: template.status,
      version: template.version,
      updated_at: template.updated_at,
    })) || [];

  return (
    <>
      <PageHeader
        title={t("nav.templates")}
        actions={
          <Button size="sm" onClick={() => createTemplate()} disabled={isCreating}>
            <Plus className="w-4 h-4 mr-1" />
            {isCreating ? t("tpl.creating") : t("common.create")}
          </Button>
        }
      />

      <PageBody>
        <TemplateGrid
          templates={normalizedTemplates}
          categories={categories}
          isLoading={isLoading}
        />
      </PageBody>
    </>
  );
}
