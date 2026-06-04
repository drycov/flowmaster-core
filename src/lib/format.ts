import { format, formatDistanceToNow } from "date-fns";
import { kk, ru } from "date-fns/locale";
import type { Locale } from "./i18n";

const map = { ru, kk };

export function fmtDate(d: string | Date | null | undefined, locale: Locale = "ru") {
  if (!d) return "—";
  return format(new Date(d), "dd.MM.yyyy HH:mm", { locale: map[locale] });
}
export function fmtDateShort(d: string | Date | null | undefined, locale: Locale = "ru") {
  if (!d) return "—";
  return format(new Date(d), "dd.MM.yyyy", { locale: map[locale] });
}
export function fmtRel(d: string | Date | null | undefined, locale: Locale = "ru") {
  if (!d) return "—";
  return formatDistanceToNow(new Date(d), { addSuffix: true, locale: map[locale] });
}
