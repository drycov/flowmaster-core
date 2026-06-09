import { differenceInCalendarDays, parseISO } from "date-fns";

export function parseYmd(key: string): Date {
  return parseISO(`${key}T12:00:00`);
}

export function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysBetweenInclusive(start: string, end: string): number {
  return differenceInCalendarDays(parseYmd(end), parseYmd(start)) + 1;
}

export function barPosition(
  itemStart: string,
  itemEnd: string,
  rangeStart: string,
  rangeEnd: string,
): { leftPct: number; widthPct: number } | null {
  const rs = parseYmd(rangeStart).getTime();
  const re = parseYmd(rangeEnd).getTime();
  const is = parseYmd(itemStart).getTime();
  const ie = parseYmd(itemEnd).getTime();
  if (ie < rs || is > re) return null;
  const total = re - rs + 86_400_000;
  const clampedStart = Math.max(is, rs);
  const clampedEnd = Math.min(ie, re);
  const leftPct = ((clampedStart - rs) / total) * 100;
  const widthPct = ((clampedEnd - clampedStart + 86_400_000) / total) * 100;
  return { leftPct, widthPct: Math.max(widthPct, 1.5) };
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = toYmd(new Date(year, month, 1));
  const to = toYmd(new Date(year, month + 1, 0));
  return { from, to };
}
