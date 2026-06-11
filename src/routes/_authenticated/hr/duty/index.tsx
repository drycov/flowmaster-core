import { createFileRoute } from "@tanstack/react-router";

import { requireModule } from "@/lib/access/route-guards";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight, Loader2, Plus, User, Users } from "lucide-react";

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

import { buildMonthCells, toDateKey } from "@/components/calendar/business-calendar-utils";

import { DutyAssignmentsList } from "@/components/scheduling/DutyAssignmentsList";
import { DutyDayList } from "@/components/scheduling/DutyDayList";
import { PersonalDutyView } from "@/components/scheduling/PersonalDutyView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { monthRange } from "@/lib/scheduling/date-range";

import { useI18n, localized } from "@/i18n";

import { listDepartments } from "@/lib/api/admin.functions";
import { useAccessContext } from "@/lib/access/hooks";

import { listStaffDirectory } from "@/lib/api/hr.functions";

import {
  cancelDutyAssignment,
  createDutyAssignment,
  listDutyAssignments,
  listDutyRoles,
  listMyDutyAssignments,
} from "@/lib/api/scheduling.functions";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/hr/duty/")({
  beforeLoad: () => requireModule("hr"),

  component: DutySchedulePage,
});

function DutySchedulePage() {
  const { t, locale } = useI18n();

  const qc = useQueryClient();

  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());

  const [month, setMonth] = useState(now.getMonth());

  const [viewMode, setViewMode] = useState<"personal" | "organization">("personal");

  const [departmentFilter, setDepartmentFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);

  const [roleId, setRoleId] = useState("");

  const [assigneeId, setAssigneeId] = useState("");

  const [substituteId, setSubstituteId] = useState("");

  const [formDepartmentId, setFormDepartmentId] = useState("");

  const [dateFrom, setDateFrom] = useState("");

  const [dateTo, setDateTo] = useState("");

  const [note, setNote] = useState("");

  const range = monthRange(year, month);

  const deptFilterId = departmentFilter === "all" ? undefined : departmentFilter;

  const formDeptId = formDepartmentId || undefined;

  const { canModule, me } = useAccessContext();

  const canManage = canModule("hr", "manage");

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],

    queryFn: listDepartments,
  });

  const branchDepartments = useMemo(
    () =>
      (
        departments as {
          id: string;
          code: string;
          name_ru: string;
          name_kk: string;
          kind?: string;
        }[]
      ).filter((d) => d.kind === "department" || d.kind === "branch"),

    [departments],
  );

  const { data: roles = [] } = useQuery({
    queryKey: ["duty-roles", formDeptId ?? "all"],

    queryFn: () =>
      listDutyRoles({
        data: formDeptId ? { department_id: formDeptId } : undefined,
      }),

    enabled: showForm,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-directory", formDeptId ?? "all"],

    queryFn: () =>
      listStaffDirectory({
        data: formDeptId ? { department_id: formDeptId } : undefined,
      }),

    enabled: canManage && showForm,
  });

  const { data: myDuties = [], isLoading: myLoading } = useQuery({
    queryKey: ["my-duty-assignments", range.from, range.to],

    queryFn: () => listMyDutyAssignments({ data: range }),

    enabled: viewMode === "personal",
  });

  const { data: duties = [], isLoading: orgLoading } = useQuery({
    queryKey: ["duty-assignments", range.from, range.to, departmentFilter],

    queryFn: () =>
      listDutyAssignments({
        data: {
          ...range,

          ...(deptFilterId ? { department_id: deptFilterId } : {}),
        },
      }),

    enabled: viewMode === "organization",
  });

  const dutiesByDay = useMemo(() => {
    const map = new Map<string, Record<string, unknown>[]>();

    for (const raw of duties) {
      const d = raw as Record<string, unknown>;

      const day = String(d.starts_at).slice(0, 10);

      const list = map.get(day) ?? [];

      list.push(d);

      map.set(day, list);
    }

    return map;
  }, [duties]);

  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  const weekdayLabels = [
    t("calendar.weekday.mon"),

    t("calendar.weekday.tue"),

    t("calendar.weekday.wed"),

    t("calendar.weekday.thu"),

    t("calendar.weekday.fri"),

    t("calendar.weekday.sat"),

    t("calendar.weekday.sun"),
  ];

  const createMut = useMutation({
    mutationFn: () =>
      createDutyAssignment({
        data: {
          duty_role_id: roleId,

          assignee_id: assigneeId,

          substitute_id: substituteId || null,

          department_id: formDeptId ?? null,

          starts_at: new Date(`${dateFrom}T09:00:00`).toISOString(),

          ends_at: new Date(`${dateTo}T18:00:00`).toISOString(),

          note: note.trim() || undefined,
        },
      }),

    onSuccess: () => {
      toast.success(t("scheduling.duty.created"));

      qc.invalidateQueries({ queryKey: ["duty-assignments"] });

      setShowForm(false);

      setRoleId("");

      setAssigneeId("");

      setSubstituteId("");

      setDateFrom("");

      setDateTo("");

      setNote("");
    },

    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelDutyAssignment({ data: { id } }),

    onSuccess: () => {
      toast.success(t("scheduling.duty.cancelled"));

      qc.invalidateQueries({ queryKey: ["duty-assignments"] });

      qc.invalidateQueries({ queryKey: ["my-duty-assignments"] });
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
        title={t("scheduling.duty.title")}
        description={
          viewMode === "personal"
            ? t("scheduling.duty.personalDescription")
            : t("scheduling.duty.description")
        }
      />

      <PageBody className="max-w-5xl space-y-6">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "personal" | "organization")}>
          <TabsList>
            <TabsTrigger value="personal" className="gap-1.5">
              <User className="h-4 w-4" />
              {t("scheduling.duty.tabPersonal")}
            </TabsTrigger>
            <TabsTrigger value="organization" className="gap-1.5">
              <Users className="h-4 w-4" />
              {t("scheduling.duty.tabOrganization")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="mt-4">
            <PersonalDutyView
              duties={myDuties as Record<string, unknown>[]}
              isLoading={myLoading}
              year={year}
              month={month}
              userId={me?.profile?.id as string | undefined}
              onYearMonthChange={(y, m) => {
                setYear(y);
                setMonth(m);
              }}
            />
          </TabsContent>

          <TabsContent value="organization" className="mt-4 space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5 sm:max-w-xs">
                <Label>{t("scheduling.duty.departmentFilter")}</Label>

                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">{t("scheduling.duty.allDepartments")}</SelectItem>

                    {branchDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {localized(d, locale, "name")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {canManage && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">{t("scheduling.duty.add")}</CardTitle>

                  <Button variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
                    <Plus className="mr-1 h-4 w-4" />

                    {showForm ? t("common.cancel") : t("scheduling.duty.add")}
                  </Button>
                </CardHeader>

                {showForm && (
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>{t("scheduling.duty.department")}</Label>

                      <Select
                        value={formDepartmentId || "__org"}
                        onValueChange={(v) => {
                          const next = v === "__org" ? "" : v;

                          setFormDepartmentId(next);

                          setRoleId("");

                          setAssigneeId("");

                          setSubstituteId("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("scheduling.duty.orgWide")} />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="__org">{t("scheduling.duty.orgWide")}</SelectItem>

                          {branchDepartments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {localized(d, locale, "name")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("scheduling.duty.role")}</Label>

                      <Select value={roleId} onValueChange={setRoleId}>
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>

                        <SelectContent>
                          {roles.map((r) => {
                            const row = r as {
                              id: string;

                              name_ru: string;

                              name_kk: string;

                              department_id?: string | null;
                            };

                            return (
                              <SelectItem key={row.id} value={row.id}>
                                {localized(row, locale, "name")}

                                {!row.department_id ? ` (${t("scheduling.duty.orgWide")})` : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("scheduling.duty.assignee")}</Label>

                      <Select
                        value={assigneeId}
                        onValueChange={(v) => {
                          setAssigneeId(v);
                          if (substituteId === v) setSubstituteId("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>

                        <SelectContent>
                          {staff.map((row) => (
                              <SelectItem key={row.id} value={row.id}>
                                {localized(row, locale, "full_name")}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("scheduling.duty.substitute")}</Label>

                      <Select
                        value={substituteId || "__none"}
                        onValueChange={(v) => setSubstituteId(v === "__none" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("scheduling.duty.substituteNone")} />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="__none">
                            {t("scheduling.duty.substituteNone")}
                          </SelectItem>

                          {staff
                            .filter((row) => row.id !== assigneeId)
                            .map((row) => (
                              <SelectItem key={row.id} value={row.id}>
                                {localized(row, locale, "full_name")}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("scheduling.duty.dateFrom")}</Label>

                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("scheduling.duty.dateTo")}</Label>

                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>{t("scheduling.duty.note")}</Label>

                      <Input value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>

                    <div className="sm:col-span-2">
                      <Button
                        disabled={
                          createMut.isPending || !roleId || !assigneeId || !dateFrom || !dateTo
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base capitalize">{monthLabel}</CardTitle>

                <div className="flex gap-1">
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
                {orgLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                      {weekdayLabels.map((l) => (
                        <div key={l}>{l}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {cells.map((date, idx) => {
                        if (!date) return <div key={`e-${idx}`} className="min-h-[88px]" />;

                        const key = toDateKey(date);

                        const dayDuties = dutiesByDay.get(key) ?? [];

                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                        return (
                          <div
                            key={key}
                            className={cn(
                              "min-h-[88px] rounded-md border p-1.5 text-xs",

                              isWeekend ? "bg-muted/40" : "bg-card",
                            )}
                          >
                            <div className="font-medium">{date.getDate()}</div>

                            <DutyDayList
                              duties={dayDuties}
                              locale={locale}
                              showDepartment={departmentFilter === "all"}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {canManage ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("scheduling.duty.listTitle")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <DutyAssignmentsList
                    duties={duties as Record<string, unknown>[]}
                    isLoading={orgLoading}
                    canManage={canManage}
                    cancellingId={cancelMut.isPending ? (cancelMut.variables as string) : null}
                    onCancel={(id) => cancelMut.mutate(id)}
                  />
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
