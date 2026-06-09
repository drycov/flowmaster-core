import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMonthCells, toDateKey } from "@/components/calendar/business-calendar-utils";
import { LeaveDayList } from "@/components/hr/LeaveDayList";
import { LeaveStatusBadge } from "@/components/hr/LeaveStatusBadge";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

type LeaveRow = Record<string, unknown>;

type Props = {
  leaves: LeaveRow[];
  isLoading: boolean;
  year: number;
  month: number;
  onYearMonthChange: (year: number, month: number) => void;
};

function leaveDaysInRange(d: LeaveRow): string[] {
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

export function PersonalLeaveView({
  leaves,
  isLoading,
  year,
  month,
  onYearMonthChange,
}: Props) {
  const { t, locale } = useI18n();
  const todayKey = toDateKey(new Date());

  const leavesByDay = useMemo(() => {
    const map = new Map<string, LeaveRow[]>();
    for (const raw of leaves) {
      for (const day of leaveDaysInRange(raw)) {
        const list = map.get(day) ?? [];
        list.push(raw);
        map.set(day, list);
      }
    }
    return map;
  }, [leaves]);

  const upcoming = useMemo(() => {
    const today = todayKey;
    return [...leaves]
      .filter((d) => String(d.date_to).slice(0, 10) >= today)
      .sort((a, b) => String(a.date_from).localeCompare(String(b.date_from)))
      .slice(0, 12);
  }, [leaves, todayKey]);

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
    onYearMonthChange(y, m);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base capitalize">{monthLabel}</CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => shiftMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                  const dayLeaves = leavesByDay.get(key) ?? [];
                  const hasLeave = dayLeaves.length > 0;
                  const isToday = key === todayKey;
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "min-h-[88px] rounded-md border p-1.5 text-xs",
                        isWeekend ? "bg-muted/40" : "bg-card",
                        hasLeave && "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20",
                        isToday && "ring-2 ring-primary",
                      )}
                    >
                      <div className={cn("font-medium", hasLeave && "text-emerald-700 dark:text-emerald-400")}>
                        {date.getDate()}
                      </div>
                      <LeaveDayList leaves={dayLeaves} locale={locale} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("hr.leave.schedule.upcoming")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("hr.leave.schedule.personalEmpty")}</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((raw) => {
                const d = raw as LeaveRow & {
                  date_from: string;
                  date_to: string;
                  business_days?: number;
                  status: string;
                  reason?: string;
                  ref_absence_types?: { name_ru: string; name_kk: string; color?: string } | null;
                };
                const type = d.ref_absence_types;
                return (
                  <li key={String(d.id)} className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <div>
                      <div className="font-medium">
                        {type ? localized(type, locale, "name") : "—"}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {fmtDateShort(String(d.date_from))}
                        {String(d.date_from) !== String(d.date_to)
                          ? ` — ${fmtDateShort(String(d.date_to))}`
                          : ""}
                        {d.business_days ? (
                          <span className="ml-1">
                            · {d.business_days} {t("hr.leave.businessDays")}
                          </span>
                        ) : null}
                      </div>
                      {d.reason ? (
                        <p className="mt-1 text-xs text-muted-foreground">{String(d.reason)}</p>
                      ) : null}
                    </div>
                    <LeaveStatusBadge status={d.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
