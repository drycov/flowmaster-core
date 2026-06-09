export type CalendarDayRecord = {
  day_date: string;
  is_holiday: boolean;
  name_ru: string;
  name_kk: string;
};

export type DayKind = "holiday" | "weekend" | "workday" | "workday_override";

export function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getDayKind(
  date: Date,
  overrides: Map<string, CalendarDayRecord>,
): DayKind {
  const key = toDateKey(date);
  const rec = overrides.get(key);
  if (rec) {
    return rec.is_holiday ? "holiday" : "workday_override";
  }
  return isWeekend(date) ? "weekend" : "workday";
}

export function buildMonthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // Monday-first: Mon=0 .. Sun=6
  const mondayOffset = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = [];

  for (let i = 0; i < mondayOffset; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function recordsToMap(records: CalendarDayRecord[]): Map<string, CalendarDayRecord> {
  return new Map(records.map((r) => [r.day_date, r]));
}
