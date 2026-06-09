import { localized, type Locale } from "@/i18n";

type NamedRef = { code: string; name_ru: string; name_kk: string };

export function resolveReferenceLabel(
  items: NamedRef[],
  code: string | null | undefined,
  locale: Locale,
): string | null {
  if (!code) return null;
  const item = items.find((row) => row.code === code);
  return item ? localized(item, locale, "name") : code;
}
