import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildMonthCells, toDateKey } from "@/components/calendar/business-calendar-utils";
import { DutyDayList } from "@/components/scheduling/DutyDayList";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

type DutyRow = Record<string, unknown>;

type Props = {
  duties: DutyRow[];
  isLoading: boolean;
  year: number;
  month: number;
  onYearMonthChange: (year: number, month: number) => void;
  userId?: string;
};

function dutyDaysInRange(d: DutyRow): string[] {
  const start = String(d.starts_at).slice(0, 10);
  const end = String(d.ends_at).slice(0, 10);
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

export function PersonalDutyView({
  duties,
  isLoading,
  year,
  month,
  onYearMonthChange,
  userId,
}: Props) {
  const { t, locale } = useI18n();
  const todayKey = toDateKey(new Date());

  const dutiesByDay = useMemo(() => {
    const map = new Map<string, DutyRow[]>();
    for (const raw of duties) {
      for (const day of dutyDaysInRange(raw)) {
        const list = map.get(day) ?? [];
        list.push(raw);
        map.set(day, list);
      }
    }
    return map;
  }, [duties]);

  const upcoming = useMemo(() => {
    const today = todayKey;
    return [...duties]
      .filter((d) => String(d.ends_at).slice(0, 10) >= today)
      .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))
      .slice(0, 12);
  }, [duties, todayKey]);

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
                  const dayDuties = dutiesByDay.get(key) ?? [];
                  const isMine = dayDuties.length > 0;
                  const isToday = key === todayKey;
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "min-h-[88px] rounded-md border p-1.5 text-xs",
                        isWeekend ? "bg-muted/40" : "bg-card",
                        isMine && "border-primary/60 bg-primary/5 ring-1 ring-primary/20",
                        isToday && "ring-2 ring-primary",
                      )}
                    >
                      <div className={cn("font-medium", isMine && "text-primary")}>
                        {date.getDate()}
                      </div>
                      <DutyDayList duties={dayDuties} locale={locale} showDepartment />
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
          <CardTitle className="text-base">{t("scheduling.duty.upcoming")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("scheduling.duty.personalEmpty")}</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((raw) => {
                const d = raw as DutyRow & {
                  starts_at: string;
                  ends_at: string;
                  status: string;
                  note?: string;
                  assignee_id?: string;
                  substitute_id?: string | null;
                  ref_duty_roles?: { name_ru: string; name_kk: string; color?: string } | null;
                  departments?: { code?: string; name_ru: string; name_kk: string } | null;
                };
                const role = d.ref_duty_roles;
                const dept = d.departments;
                const isSubstitute =
                  userId && d.substitute_id === userId && d.assignee_id !== userId;
                return (
                  <li
                    key={String(d.id)}
                    className="flex flex-wrap items-start justify-between gap-2 py-3"
                  >
                    <div>
                      <div className="font-medium">
                        {role ? localized(role, locale, "name") : "—"}
                        {dept ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {dept.code ?? localized(dept, locale, "name")}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {fmtDateShort(String(d.starts_at).slice(0, 10))}
                        {String(d.starts_at).slice(0, 10) !== String(d.ends_at).slice(0, 10)
                          ? ` — ${fmtDateShort(String(d.ends_at).slice(0, 10))}`
                          : ""}
                      </div>
                      {d.note ? (
                        <p className="mt-1 text-xs text-muted-foreground">{String(d.note)}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      {isSubstitute ? (
                        <Badge variant="outline">{t("scheduling.duty.asSubstitute")}</Badge>
                      ) : null}
                      <Badge variant="secondary">{d.status}</Badge>
                    </div>
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
