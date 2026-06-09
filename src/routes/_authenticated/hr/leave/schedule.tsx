import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Loader2,
  User,
  Users,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildMonthCells, toDateKey } from "@/components/calendar/business-calendar-utils";
import { LeaveDayList } from "@/components/hr/LeaveDayList";
import { PersonalLeaveView } from "@/components/hr/PersonalLeaveView";
import { useI18n, localized } from "@/i18n";
import { getMyProfile, listDepartments } from "@/lib/api/admin.functions";
import { listDepartmentLeaveCalendar, listMyLeaveCalendar } from "@/lib/api/hr.functions";
import { exportLeaveScheduleCsv } from "@/lib/hr/export-leave-schedule";
import { monthRange } from "@/lib/scheduling/date-range";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/hr/leave/schedule")({
  beforeLoad: () => requireModule("hr"),
  component: LeaveSchedulePage,
});

function leaveDaysInRange(d: Record<string, unknown>): string[] {
  const start = String(d.date_from).slice(0, 10);
  const end = String(d.date_to).slice(0, 10);
  const days: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cur <= last) {
    days.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
    );
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function LeaveSchedulePage() {
  const { t, locale } = useI18n();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState<"personal" | "organization">("personal");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const range = useMemo(() => monthRange(year, month), [year, month]);
  const todayKey = toDateKey(new Date());

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMyProfile });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });

  const branchDepartments = useMemo(
    () =>
      (departments as { id: string; code?: string; name_ru: string; name_kk: string }[]).filter(
        (d) => d.code?.startsWith("UKG-SAT-"),
      ),
    [departments],
  );

  const deptFilterId = departmentFilter === "all" ? undefined : departmentFilter;

  const { data: myLeaves = [], isLoading: myLoading } = useQuery({
    queryKey: ["my-leave-calendar", range.from, range.to],
    queryFn: () => listMyLeaveCalendar({ data: range }),
    enabled: viewMode === "personal",
  });

  const { data: teamLeaves = [], isLoading: teamLoading } = useQuery({
    queryKey: ["team-leave-calendar", range.from, range.to, departmentFilter],
    queryFn: () =>
      listDepartmentLeaveCalendar({
        data: { ...range, ...(deptFilterId ? { department_id: deptFilterId } : {}) },
      }),
    enabled: viewMode === "organization",
  });

  const teamByDay = useMemo(() => {
    const map = new Map<string, Record<string, unknown>[]>();
    for (const raw of teamLeaves as Record<string, unknown>[]) {
      for (const day of leaveDaysInRange(raw)) {
        const list = map.get(day) ?? [];
        list.push(raw);
        map.set(day, list);
      }
    }
    return map;
  }, [teamLeaves]);

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

  const monthLabel = new Date(year, month, 1).toLocaleDateString(
    locale === "kk" ? "kk-KZ" : "ru-RU",
    { month: "long", year: "numeric" },
  );

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  };

  const myDeptId = (me?.profile as { department_id?: string | null } | undefined)?.department_id;

  return (
    <>
      <PageHeader
        title={t("hr.leave.schedule.title")}
        description={
          viewMode === "personal"
            ? t("hr.leave.schedule.personalDescription")
            : t("hr.leave.schedule.organizationDescription")
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/hr/leave">
              <ClipboardList className="mr-1 h-4 w-4" />
              {t("hr.leave.schedule.backToRequests")}
            </Link>
          </Button>
        }
      />
      <PageBody className="max-w-5xl space-y-6">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "personal" | "organization")}>
          <TabsList>
            <TabsTrigger value="personal" className="gap-1.5">
              <User className="h-4 w-4" />
              {t("hr.leave.schedule.tabPersonal")}
            </TabsTrigger>
            <TabsTrigger value="organization" className="gap-1.5">
              <Users className="h-4 w-4" />
              {t("hr.leave.schedule.tabOrganization")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="mt-4">
            <PersonalLeaveView
              leaves={myLeaves as Record<string, unknown>[]}
              isLoading={myLoading}
              year={year}
              month={month}
              onYearMonthChange={(y, m) => {
                setYear(y);
                setMonth(m);
              }}
            />
          </TabsContent>

          <TabsContent value="organization" className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder={t("hr.leave.schedule.department")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("hr.leave.schedule.allDepartments")}</SelectItem>
                  {branchDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code ?? localized(d, locale, "name")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={teamLoading || !(teamLeaves as unknown[]).length}
                  onClick={() =>
                    exportLeaveScheduleCsv(
                      teamLeaves as Record<string, unknown>[],
                      {
                        employee: t("hr.leave.schedule.exportEmployee"),
                        type: t("hr.leave.type"),
                        from: t("hr.leave.dateFrom"),
                        to: t("hr.leave.dateTo"),
                        days: t("hr.leave.businessDays"),
                        status: t("hr.leave.schedule.exportStatus"),
                      },
                      (row) => {
                        const r = row as {
                          date_from: string;
                          date_to: string;
                          business_days?: number;
                          status: string;
                          employee?: { full_name_ru?: string; full_name_kk?: string };
                          ref_absence_types?: { name_ru: string; name_kk: string };
                        };
                        return {
                          employee: localized(r.employee ?? {}, locale, "full_name") || "—",
                          type: localized(r.ref_absence_types ?? {}, locale, "name") || "—",
                          from: r.date_from,
                          to: r.date_to,
                          days: String(r.business_days ?? ""),
                          status:
                            t(`hr.leave.status.${r.status}`) !== `hr.leave.status.${r.status}`
                              ? t(`hr.leave.status.${r.status}`)
                              : r.status,
                        };
                      },
                    )
                  }
                >
                  <Download className="mr-1 h-4 w-4" />
                  {t("hr.leave.schedule.export")}
                </Button>
                <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => shiftMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {!deptFilterId && !myDeptId ? (
              <p className="text-sm text-muted-foreground">{t("hr.leave.schedule.noDepartment")}</p>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base capitalize">{monthLabel}</CardTitle>
                </CardHeader>
                <CardContent>
                  {teamLoading ? (
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
                          if (!date) return <div key={`e-${idx}`} className="min-h-[96px]" />;
                          const key = toDateKey(date);
                          const dayLeaves = teamByDay.get(key) ?? [];
                          const hasLeave = dayLeaves.length > 0;
                          const isToday = key === todayKey;
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                          return (
                            <div
                              key={key}
                              className={cn(
                                "min-h-[96px] rounded-md border p-1.5 text-xs",
                                isWeekend ? "bg-muted/40" : "bg-card",
                                hasLeave && "border-emerald-500/40 bg-emerald-500/5",
                                isToday && "ring-2 ring-primary",
                              )}
                            >
                              <div className="font-medium">{date.getDate()}</div>
                              <LeaveDayList leaves={dayLeaves} locale={locale} showEmployee />
                            </div>
                          );
                        })}
                      </div>
                      {(teamLeaves as unknown[]).length === 0 ? (
                        <p className="mt-4 text-sm text-muted-foreground">
                          {t("hr.leave.schedule.organizationEmpty")}
                        </p>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
