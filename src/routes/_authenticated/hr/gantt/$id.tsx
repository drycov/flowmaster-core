import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/AppShell";
import { GanttChart, type GanttItem } from "@/components/scheduling/GanttChart";
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
import { useAccessContext } from "@/lib/access/hooks";
import { listStaffDirectory } from "@/lib/api/hr.functions";
import { getSchedulePlan, upsertSchedulePlanItem } from "@/lib/api/scheduling.functions";

export const Route = createFileRoute("/_authenticated/hr/gantt/$id")({
  beforeLoad: () => requireModule("hr"),
  component: GanttDetailPage,
});

function GanttDetailPage() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [titleRu, setTitleRu] = useState("");
  const [titleKk, setTitleKk] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [itemType, setItemType] = useState<"task" | "milestone" | "phase">("task");
  const [progress, setProgress] = useState("0");

  const { canModule } = useAccessContext();
  const canEdit = canModule("hr", "manage") || canModule("projects", "manage");

  const { data, isLoading } = useQuery({
    queryKey: ["schedule-plan", id],
    queryFn: () => getSchedulePlan({ data: { id } }),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-directory"],
    queryFn: () => listStaffDirectory({ data: undefined }),
    enabled: canEdit && showForm,
  });

  const plan = data?.plan as Record<string, unknown> | undefined;
  const items = (data?.items ?? []) as Record<string, unknown>[];

  const { rangeStart, rangeEnd, ganttItems } = useMemo(() => {
    const planStart = plan?.planned_start ? String(plan.planned_start) : null;
    const planEnd = plan?.planned_end ? String(plan.planned_end) : null;
    let min = planStart;
    let max = planEnd;
    for (const raw of items) {
      const s = String(raw.planned_start);
      const e = String(raw.planned_end);
      if (!min || s < min) min = s;
      if (!max || e > max) max = e;
    }
    if (!min || !max) {
      const today = new Date().toISOString().slice(0, 10);
      min = min ?? today;
      max = max ?? today;
    }
    const gantt: GanttItem[] = items.map((raw) => {
      const assignee = raw.assignee as { full_name_ru?: string; full_name_kk?: string } | null;
      return {
        id: String(raw.id),
        label: localized(raw, locale, "title"),
        start: String(raw.planned_start),
        end: String(raw.planned_end),
        color: String(raw.color ?? "#3b82f6"),
        progress: Number(raw.progress_pct ?? 0),
        sublabel: assignee ? localized(assignee, locale, "full_name") : undefined,
      };
    });
    return { rangeStart: min, rangeEnd: max, ganttItems: gantt };
  }, [plan, items, locale]);

  const createMut = useMutation({
    mutationFn: () =>
      upsertSchedulePlanItem({
        data: {
          plan_id: id,
          title_ru: titleRu.trim(),
          title_kk: titleKk.trim(),
          planned_start: plannedStart,
          planned_end: plannedEnd,
          assignee_id: assigneeId || null,
          item_type: itemType,
          progress_pct: parseInt(progress, 10) || 0,
        },
      }),
    onSuccess: () => {
      toast.success(t("scheduling.gantt.itemSaved"));
      qc.invalidateQueries({ queryKey: ["schedule-plan", id] });
      setShowForm(false);
      setTitleRu("");
      setTitleKk("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!plan) {
    return (
      <PageBody>
        <p className="text-muted-foreground">{t("scheduling.gantt.notFound")}</p>
      </PageBody>
    );
  }

  return (
    <>
      <PageHeader
        title={`${plan.code} — ${localized(plan, locale, "name")}`}
        description={t("scheduling.gantt.detailDescription")}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/hr/gantt">
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t("scheduling.gantt.back")}
            </Link>
          </Button>
        }
      />
      <PageBody className="max-w-6xl space-y-6">
        {canEdit && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{t("scheduling.gantt.addItem")}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
                <Plus className="mr-1 h-4 w-4" />
                {showForm ? t("common.cancel") : t("scheduling.gantt.addItem")}
              </Button>
            </CardHeader>
            {showForm && (
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.itemTitleRu")}</Label>
                  <Input value={titleRu} onChange={(e) => setTitleRu(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.itemTitleKk")}</Label>
                  <Input value={titleKk} onChange={(e) => setTitleKk(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.itemType")}</Label>
                  <Select value={itemType} onValueChange={(v) => setItemType(v as typeof itemType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task">{t("scheduling.gantt.itemTypes.task")}</SelectItem>
                      <SelectItem value="milestone">
                        {t("scheduling.gantt.itemTypes.milestone")}
                      </SelectItem>
                      <SelectItem value="phase">{t("scheduling.gantt.itemTypes.phase")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.assignee")}</Label>
                  <Select
                    value={assigneeId || "__none"}
                    onValueChange={(v) => setAssigneeId(v === "__none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {staff.map((row) => (
                          <SelectItem key={row.id} value={row.id}>
                            {localized(row, locale, "full_name")}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.dateFrom")}</Label>
                  <Input
                    type="date"
                    value={plannedStart}
                    onChange={(e) => setPlannedStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.dateTo")}</Label>
                  <Input
                    type="date"
                    value={plannedEnd}
                    onChange={(e) => setPlannedEnd(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("scheduling.gantt.progress")}</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={(e) => setProgress(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    disabled={
                      createMut.isPending ||
                      !titleRu.trim() ||
                      !titleKk.trim() ||
                      !plannedStart ||
                      !plannedEnd
                    }
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
            <CardTitle className="text-base">{t("scheduling.gantt.chart")}</CardTitle>
          </CardHeader>
          <CardContent>
            <GanttChart
              items={ganttItems}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              locale={locale}
            />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
