import { createFileRoute } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";
import { monthRange } from "@/lib/scheduling/date-range";
import { listDocumentProjects } from "@/lib/api/projects.functions";
import {
  listMyWorkTimeEntries,
  submitWorkTimeEntries,
  upsertWorkTimeEntry,
} from "@/lib/api/scheduling.functions";

export const Route = createFileRoute("/_authenticated/hr/timesheet/")({
  beforeLoad: () => requireModule("hr"),
  component: TimesheetPage,
});

const ENTRY_TYPES = ["work", "overtime", "break", "remote", "business_trip"] as const;

function minutesToHours(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}:${String(min).padStart(2, "0")}` : String(h);
}

function TimesheetPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [showForm, setShowForm] = useState(false);
  const [workDate, setWorkDate] = useState("");
  const [hours, setHours] = useState("8");
  const [entryType, setEntryType] = useState<(typeof ENTRY_TYPES)[number]>("work");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");

  const range = monthRange(year, month);
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["work-time-entries", range.from, range.to],
    queryFn: () => listMyWorkTimeEntries({ data: range }),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-brief-timesheet"],
    queryFn: () => listDocumentProjects({ data: { active_only: true } }),
  });

  const totalMinutes = useMemo(
    () =>
      entries.reduce((sum, raw) => {
        const row = raw as { duration_minutes?: number; entry_type?: string };
        return row.entry_type === "break" ? sum : sum + (row.duration_minutes ?? 0);
      }, 0),
    [entries],
  );

  const draftIds = useMemo(
    () =>
      entries
        .filter((raw) => (raw as { status?: string }).status === "draft")
        .map((raw) => String((raw as { id: string }).id)),
    [entries],
  );

  const createMut = useMutation({
    mutationFn: () => {
      const h = parseFloat(hours.replace(",", "."));
      if (!Number.isFinite(h) || h <= 0) throw new Error(t("scheduling.timesheet.invalidHours"));
      const duration_minutes = Math.round(h * 60);
      return upsertWorkTimeEntry({
        data: {
          work_date: workDate,
          duration_minutes,
          entry_type: entryType,
          project_id: projectId || null,
          description: description.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("scheduling.timesheet.saved"));
      qc.invalidateQueries({ queryKey: ["work-time-entries"] });
      setShowForm(false);
      setWorkDate("");
      setDescription("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const submitMut = useMutation({
    mutationFn: () => submitWorkTimeEntries({ data: { ids: draftIds } }),
    onSuccess: () => {
      toast.success(t("scheduling.timesheet.submitted"));
      qc.invalidateQueries({ queryKey: ["work-time-entries"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const monthLabel = new Date(year, month, 1).toLocaleDateString(
    locale === "kk" ? "kk-KZ" : "ru-RU",
    { month: "long", year: "numeric" },
  );

  return (
    <>
      <PageHeader
        title={t("scheduling.timesheet.title")}
        description={t("scheduling.timesheet.description")}
      />
      <PageBody className="max-w-4xl space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              {t("scheduling.timesheet.add")}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="mr-1 h-4 w-4" />
              {showForm ? t("common.cancel") : t("scheduling.timesheet.add")}
            </Button>
          </CardHeader>
          {showForm && (
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("scheduling.timesheet.date")}</Label>
                <Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("scheduling.timesheet.hours")}</Label>
                <Input
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("scheduling.timesheet.type")}</Label>
                <Select value={entryType} onValueChange={(v) => setEntryType(v as typeof entryType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`scheduling.timesheet.entryType.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("scheduling.timesheet.project")}</Label>
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("scheduling.timesheet.note")}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  disabled={createMut.isPending || !workDate}
                  onClick={() => createMut.mutate()}
                >
                  {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.save")}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base capitalize">{monthLabel}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("scheduling.timesheet.total")}: {minutesToHours(totalMinutes)} {t("scheduling.timesheet.hoursShort")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {draftIds.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={submitMut.isPending}
                  onClick={() => submitMut.mutate()}
                >
                  {submitMut.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-4 w-4" />
                  )}
                  {t("scheduling.timesheet.submit")} ({draftIds.length})
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (month === 0) {
                    setYear((y) => y - 1);
                    setMonth(11);
                  } else setMonth((m) => m - 1);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (month === 11) {
                    setYear((y) => y + 1);
                    setMonth(0);
                  } else setMonth((m) => m + 1);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("scheduling.timesheet.empty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium">{t("scheduling.timesheet.date")}</th>
                      <th className="px-2 py-2 font-medium">{t("scheduling.timesheet.type")}</th>
                      <th className="px-2 py-2 font-medium">{t("scheduling.timesheet.hours")}</th>
                      <th className="px-2 py-2 font-medium">{t("scheduling.timesheet.project")}</th>
                      <th className="px-2 py-2 font-medium">{t("scheduling.timesheet.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((raw) => {
                      const row = raw as {
                        id: string;
                        work_date: string;
                        duration_minutes: number;
                        entry_type: string;
                        status: string;
                        description?: string;
                        document_projects?: { code: string; name_ru: string; name_kk: string } | null;
                      };
                      return (
                        <tr key={row.id} className="border-b last:border-b-0">
                          <td className="px-2 py-2">{fmtDateShort(row.work_date)}</td>
                          <td className="px-2 py-2">
                            {t(`scheduling.timesheet.entryType.${row.entry_type}` as "scheduling.timesheet.entryType.work")}
                          </td>
                          <td className="px-2 py-2">{minutesToHours(row.duration_minutes)}</td>
                          <td className="px-2 py-2 text-muted-foreground">
                            {row.document_projects
                              ? `${row.document_projects.code}`
                              : row.description || "—"}
                          </td>
                          <td className="px-2 py-2">
                            <Badge variant={row.status === "draft" ? "secondary" : "outline"}>
                              {t(`scheduling.timesheet.status.${row.status}` as "scheduling.timesheet.status.draft")}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
