import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FilePlus2, Plus, Trash2 } from "lucide-react";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useI18n, localized } from "@/i18n";
import {
  getDocumentProject,
  listProjectDocuments,
  upsertProjectTemplate,
  deleteProjectTemplate,
} from "@/lib/api/projects.functions";
import { listTemplates } from "@/lib/api/templates.functions";
import { getMyProfile } from "@/lib/api/admin.functions";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  beforeLoad: () => requireModule("projects"),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [templateId, setTemplateId] = useState("");
  const [labelRu, setLabelRu] = useState("");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMyProfile });
  const canManage =
    !!me?.permissions?.manage_projects || !!me?.permissions?.manage_documents;

  const { data: project, isLoading } = useQuery({
    queryKey: ["document-project", id],
    queryFn: () => getDocumentProject({ data: { id } }),
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["project-documents", id],
    queryFn: () => listProjectDocuments({ data: { project_id: id } }),
  });

  const { data: allTemplates = [] } = useQuery({
    queryKey: ["tpls"],
    queryFn: listTemplates,
    enabled: canManage,
  });

  const addTplMut = useMutation({
    mutationFn: () =>
      upsertProjectTemplate({
        data: {
          project_id: id,
          template_id: templateId,
          label_ru: labelRu,
          label_kk: labelRu,
          sort_order: (project?.document_project_templates?.length ?? 0) + 1,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-project", id] });
      setTemplateId("");
      setLabelRu("");
      toast.success(t("project.templateAdded"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("project.error")),
  });

  const delTplMut = useMutation({
    mutationFn: (tplRowId: string) => deleteProjectTemplate({ data: { id: tplRowId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-project", id] }),
  });

  if (isLoading) return <PageBody>{t("common.loading")}</PageBody>;
  if (!project) return <PageBody>{t("errors.notFound.description")}</PageBody>;

  const templates = (project.document_project_templates ?? []) as Array<{
    id: string;
    label_ru: string;
    label_kk: string;
    is_required: boolean;
    sort_order: number;
    template_id: string;
    document_templates?: { id: string; name_ru: string; name_kk: string } | null;
  }>;

  const createDoc = (templateId: string) => {
    navigate({
      to: "/documents/new",
      search: {
        projectId: id,
        templateId,
        nomenclatureId: project.nomenclature_id ?? undefined,
        departmentId: project.department_id ?? undefined,
      },
    });
  };

  return (
    <>
      <PageHeader
        title={`${project.code} — ${localized(project, locale, "name")}`}
        description={localized(project, locale, "description") || t("project.detailSubtitle")}
      />
      <PageBody>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {project.departments && (
              <span>
                {t("project.department")}: {localized(project.departments as never, locale, "name")}
              </span>
            )}
            {project.nomenclature_items && (
              <span>
                {t("nav.nomenclature")}:{" "}
                {(project.nomenclature_items as { code: string }).code}{" "}
                {localized(project.nomenclature_items as never, locale, "title")}
              </span>
            )}
            <StatusBadge status={project.status as string} kind="status" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("project.templates")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("project.noTemplates")}</p>
              )}
              {templates
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-2 border rounded-sm px-3 py-2"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {row.label_ru ||
                          (row.document_templates
                            ? localized(row.document_templates, locale, "name")
                            : row.template_id)}
                        {row.is_required ? ` (${t("project.required")})` : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => createDoc(row.template_id)}>
                        <FilePlus2 className="w-3 h-3 mr-1" />
                        {t("project.createDoc")}
                      </Button>
                      {canManage && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => delTplMut.mutate(row.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

              {canManage && (
                <div className="grid sm:grid-cols-3 gap-2 pt-2 border-t">
                  <div className="sm:col-span-2">
                    <Label>{t("nav.templates")}</Label>
                    <Select value={templateId || "none"} onValueChange={(v) => setTemplateId(v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allTemplates.map((tp: { id: string; name_ru: string; name_kk: string }) => (
                          <SelectItem key={tp.id} value={tp.id}>
                            {localized(tp, locale, "name")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("project.templateLabel")}</Label>
                    <Input value={labelRu} onChange={(e) => setLabelRu(e.target.value)} />
                  </div>
                  <Button
                    size="sm"
                    className="sm:col-span-3 w-fit"
                    disabled={!templateId || addTplMut.isPending}
                    onClick={() => addTplMut.mutate()}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {t("project.addTemplate")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("project.documents")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
              ) : (
                docs.map((d: { id: string; reg_number: string; title_ru: string; title_kk: string; status: string }) => (
                  <Link
                    key={d.id}
                    to="/documents/$id"
                    params={{ id: d.id }}
                    className="block border rounded-sm px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <span className="font-mono text-xs mr-2">{d.reg_number}</span>
                    {localized(d, locale, "title")}
                    <StatusBadge status={d.status} kind="status" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
