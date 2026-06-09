// src/routes/_authenticated/templates/index.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireLicenseModule } from "@/lib/license/route-guards";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useI18n } from "@/i18n";
import { listTemplates } from "@/lib/api/templates.functions";
import { getMyProfile } from "@/lib/api/admin.functions";
import { listTemplateCategoriesBrief } from "@/lib/api/references.functions";

import { useTemplateCreation } from "@/components/templates-list/hooks/useTemplateCreation";
import { TemplateGrid } from "@/components/templates-list/components/TemplateGrid";

export const Route = createFileRoute("/_authenticated/templates/")({
  beforeLoad: async () => {
    await requireLicenseModule("templates");
    const data = await getMyProfile();
    const isAdmin = data.roles.includes("admin");
    const canManage = data.permissions["manage_templates"];
    if (!isAdmin && !canManage) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: TemplatesList,
});

function TemplatesList() {
  const { t } = useI18n();
  
  const { data: templates, isLoading } = useQuery({
    queryKey: ["tpls"],
    queryFn: () => listTemplates(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["ref-template-categories"],
    queryFn: () => listTemplateCategoriesBrief(),
  });

  const { createTemplate, isCreating } = useTemplateCreation();

  // Трансформируем данные для компонентов (если нужно)
  const normalizedTemplates = templates?.map(template => ({
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
          <Button 
            size="sm" 
            onClick={() => createTemplate()}
            disabled={isCreating}
          >
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
