import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChartGantt, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";
import { useAccessContext } from "@/lib/access/hooks";
import { listDocumentProjects } from "@/lib/api/projects.functions";
import { createSchedulePlan, listSchedulePlans } from "@/lib/api/scheduling.functions";

export const Route = createFileRoute("/_authenticated/hr/gantt/")({
  beforeLoad: () => requireModule("hr"),
  component: GanttListPage,
});

function GanttListPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [nameKk, setNameKk] = useState("");
  const [planType, setPlanType] = useState<"project" | "department" | "general">("general");
  const [projectId, setProjectId] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");

  const { canModule } = useAccessContext();
  const canCreate = canModule("hr", "manage") || canModule("projects", "manage");

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["schedule-plans"],
    queryFn: listSchedulePlans,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-brief-gantt"],
    queryFn: () => listDocumentProjects({ data: { active_only: true } }),
    enabled: showForm,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createSchedulePlan({
        data: {
          code: code.trim(),
          name_ru: nameRu.trim(),
          name_kk: nameKk.trim(),
          plan_type: planType,
          project_id: projectId || null,
          planned_start: plannedStart || null,
          planned_end: plannedEnd || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("scheduling.gantt.created"));
      qc.invalidateQueries({ queryKey: ["schedule-plans"] });
      setShowForm(false);
      setCode("");
      setNameRu("");
      setNameKk("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <>
      <PageHeader
        title={t("scheduling.gantt.title")}
        description={t("scheduling.gantt.description")}
      />
      <PageBody className="max-w-4xl space-y-6">
        {canCreate && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ChartGantt className="h-4 w-4" />
                {t("scheduling.gantt.newPlan")}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
                <Plus className="mr-1 h-4 w-4" />
                {showForm ? t("common.cancel") : t("scheduling.gantt.newPlan")}
              </Button>
            </CardHeader>
            {showForm && (
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.code")}</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.planType")}</Label>
                  <Select value={planType} onValueChange={(v) => setPlanType(v as typeof planType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">{t("scheduling.gantt.type.general")}</SelectItem>
                      <SelectItem value="project">{t("scheduling.gantt.type.project")}</SelectItem>
                      <SelectItem value="department">{t("scheduling.gantt.type.department")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.nameRu")}</Label>
                  <Input value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.nameKk")}</Label>
                  <Input value={nameKk} onChange={(e) => setNameKk(e.target.value)} />
                </div>
                {planType === "project" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{t("scheduling.gantt.project")}</Label>
                    <Select value={projectId || "__none"} onValueChange={(v) => setProjectId(v === "__none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        {projects.map((p) => {
                          const row = p as { id: string; code: string; name_ru: string; name_kk: string };
                          return (
                            <SelectItem key={row.id} value={row.id}>
                              {row.code} — {localized(row, locale, "name")}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.dateFrom")}</Label>
                  <Input type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.dateTo")}</Label>
                  <Input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    disabled={createMut.isPending || !code.trim() || !nameRu.trim() || !nameKk.trim()}
                    onClick={() => createMut.mutate()}
                  >
                    {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("common.save")}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("scheduling.gantt.plans")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : plans.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("scheduling.gantt.empty")}</p>
            ) : (
              <ul className="divide-y">
                {plans.map((raw) => {
                  const row = raw as {
                    id: string;
                    code: string;
                    name_ru: string;
                    name_kk: string;
                    plan_type: string;
                    planned_start?: string | null;
                    planned_end?: string | null;
                    status: string;
                    document_projects?: { code: string } | null;
                  };
                  return (
                    <li key={row.id}>
                      <Link
                        to="/hr/gantt/$id"
                        params={{ id: row.id }}
                        className="flex items-center justify-between gap-4 px-1 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div>
                          <div className="font-medium">
                            {row.code} — {localized(row, locale, "name")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t(`scheduling.gantt.type.${row.plan_type}` as "scheduling.gantt.type.general")}
                            {row.document_projects ? ` · ${row.document_projects.code}` : ""}
                            {row.planned_start && row.planned_end
                              ? ` · ${fmtDateShort(row.planned_start)} — ${fmtDateShort(row.planned_end)}`
                              : ""}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{row.status}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
