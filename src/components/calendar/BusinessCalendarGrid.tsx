import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n, localized } from "@/i18n";
import {
  buildMonthCells,
  getDayKind,
  recordsToMap,
  toDateKey,
  type CalendarDayRecord,
  type DayKind,
} from "./business-calendar-utils";

const DAY_KIND_CLASS: Record<DayKind, string> = {
  workday: "bg-card hover:bg-muted/60",
  weekend: "bg-muted/50 text-muted-foreground hover:bg-muted",
  holiday: "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200 hover:bg-red-200/80",
  workday_override:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 hover:bg-emerald-200/80",
};

interface BusinessCalendarGridProps {
  year: number;
  month: number;
  days: CalendarDayRecord[];
  onYearMonthChange: (year: number, month: number) => void;
  onDayClick: (dateKey: string, record?: CalendarDayRecord) => void;
  readOnly?: boolean;
}

export function BusinessCalendarGrid({
  year,
  month,
  days,
  onYearMonthChange,
  onDayClick,
  readOnly = false,
}: BusinessCalendarGridProps) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);

  const overrides = useMemo(() => recordsToMap(days), [days]);
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
    const d = new Date(year, month + delta, 1);
    onYearMonthChange(d.getFullYear(), d.getMonth());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" size="icon" variant="outline" onClick={() => shiftMonth(-1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="text-sm font-semibold capitalize">{monthLabel}</h3>
        <Button type="button" size="icon" variant="outline" onClick={() => shiftMonth(1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.keys(DAY_KIND_CLASS) as DayKind[]).map((kind) => (
          <div key={kind} className="flex items-center gap-1.5">
            <span className={cn("w-3 h-3 rounded-sm border border-border", DAY_KIND_CLASS[kind])} />
            <span>{t(`calendar.legend.${kind}`)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground uppercase">
        {weekdayLabels.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="min-h-[4.5rem]" />;
          }

          const key = toDateKey(date);
          const rec = overrides.get(key);
          const kind = getDayKind(date, overrides);
          const isSelected = selected === key;
          const label = rec ? localized(rec, locale, "name") : "";

          return (
            <button
              key={key}
              type="button"
              disabled={readOnly}
              onClick={() => {
                setSelected(key);
                onDayClick(key, rec);
              }}
              className={cn(
                "min-h-[4.5rem] rounded-sm border border-border/60 p-1 text-left transition-colors",
                DAY_KIND_CLASS[kind],
                isSelected && "ring-2 ring-primary ring-offset-1",
                readOnly && "cursor-default",
              )}
            >
              <div className="text-xs font-semibold tabular-nums">{date.getDate()}</div>
              {label ? (
                <div className="text-[9px] leading-tight mt-0.5 line-clamp-2 opacity-90">{label}</div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
