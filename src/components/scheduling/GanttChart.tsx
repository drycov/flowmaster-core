import { useMemo } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ru, kk } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { barPosition } from "@/lib/scheduling/date-range";

export type GanttItem = {
  id: string;
  label: string;
  start: string;
  end: string;
  color?: string;
  progress?: number;
  sublabel?: string;
};

type GanttChartProps = {
  items: GanttItem[];
  rangeStart: string;
  rangeEnd: string;
  locale?: "ru" | "kk";
  className?: string;
};

function dateLocale(locale: "ru" | "kk") {
  return locale === "kk" ? kk : ru;
}

export function GanttChart({
  items,
  rangeStart,
  rangeEnd,
  locale = "ru",
  className,
}: GanttChartProps) {
  const loc = dateLocale(locale);
  const totalDays = differenceInCalendarDays(parseISO(rangeEnd), parseISO(rangeStart)) + 1;

  const headers = useMemo(() => {
    const result: { key: string; label: string; isWeekStart: boolean }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(parseISO(rangeStart), i);
      result.push({
        key: format(d, "yyyy-MM-dd"),
        label: format(d, "d", { locale: loc }),
        isWeekStart: d.getDay() === 1,
      });
    }
    return result;
  }, [rangeStart, totalDays, loc]);

  const monthMarkers = useMemo(() => {
    const markers: { key: string; label: string; leftPct: number }[] = [];
    let lastMonth = -1;
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(parseISO(rangeStart), i);
      if (d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth();
        markers.push({
          key: format(d, "yyyy-MM"),
          label: format(d, "LLL yyyy", { locale: loc }),
          leftPct: (i / totalDays) * 100,
        });
      }
    }
    return markers;
  }, [rangeStart, totalDays, loc]);

  return (
    <div className={cn("overflow-x-auto rounded-xl border bg-card", className)}>
      <div className="min-w-[720px]">
        <div className="relative border-b bg-muted/40 px-2 py-1.5 text-xs font-medium">
          {monthMarkers.map((m) => (
            <span
              key={m.key}
              className="absolute top-1.5 text-muted-foreground"
              style={{ left: `calc(180px + ${m.leftPct}% * (100% - 180px) / 100)` }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex border-b bg-muted/30 text-[10px] text-muted-foreground">
          <div className="w-[180px] shrink-0 border-r px-3 py-2 font-medium"> </div>
          <div className="relative flex flex-1">
            {headers.map((h) => (
              <div
                key={h.key}
                className={cn(
                  "flex-1 border-r py-1 text-center last:border-r-0",
                  h.isWeekStart && "border-l-2 border-l-muted-foreground/30",
                )}
              >
                {h.label}
              </div>
            ))}
          </div>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">—</div>
        ) : (
          items.map((item) => {
            const pos = barPosition(item.start, item.end, rangeStart, rangeEnd);
            return (
              <div key={item.id} className="flex border-b last:border-b-0">
                <div className="w-[180px] shrink-0 border-r px-3 py-2">
                  <div className="truncate text-sm font-medium">{item.label}</div>
                  {item.sublabel && (
                    <div className="truncate text-xs text-muted-foreground">{item.sublabel}</div>
                  )}
                </div>
                <div className="relative flex-1 py-2">
                  <div className="absolute inset-0 flex">
                    {headers.map((h) => (
                      <div
                        key={h.key}
                        className={cn(
                          "flex-1 border-r border-dashed border-muted/40 last:border-r-0",
                          h.isWeekStart && "border-l-2 border-l-muted/60",
                        )}
                      />
                    ))}
                  </div>
                  {pos && (
                    <div
                      className="absolute top-1/2 h-6 -translate-y-1/2 rounded-md shadow-sm"
                      style={{
                        left: `${pos.leftPct}%`,
                        width: `${pos.widthPct}%`,
                        backgroundColor: item.color ?? "#3b82f6",
                        opacity: 0.9,
                      }}
                      title={`${item.start} — ${item.end}`}
                    >
                      {(item.progress ?? 0) > 0 && (
                        <div
                          className="h-full rounded-md bg-black/20"
                          style={{ width: `${item.progress}%` }}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
