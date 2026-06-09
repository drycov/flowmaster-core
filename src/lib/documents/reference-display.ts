import { localized, type Locale } from "@/i18n";

type NamedRef = { name_ru?: string; name_kk?: string; code?: string } | null | undefined;

function unwrapJoin<T extends NamedRef>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function documentTypeLabel(
  doc: {
    doc_type?: string;
    ref_document_types?: NamedRef | NamedRef[] | null;
  },
  locale: Locale,
): string {
  const joined = unwrapJoin(doc.ref_document_types);
  if (joined) return localized(joined as { name_ru: string; name_kk: string }, locale, "name");
  return doc.doc_type || "—";
}

export function priorityLabel(
  doc: { ref_priorities?: NamedRef | NamedRef[] | null },
  locale: Locale,
): string {
  const joined = unwrapJoin(doc.ref_priorities);
  if (joined) return localized(joined as { name_ru: string; name_kk: string }, locale, "name");
  return "—";
}

export function correspondentLabel(
  doc: { ref_correspondents?: NamedRef | NamedRef[] | null },
  locale: Locale,
): string {
  const joined = unwrapJoin(doc.ref_correspondents);
  if (joined) {
    const name = localized(joined as { name_ru: string; name_kk: string }, locale, "name");
    const bin = (joined as { bin?: string }).bin;
    return bin ? `${name} (${bin})` : name;
  }
  return "—";
}

export function registrationJournalLabel(
  doc: { ref_registration_journals?: (NamedRef & { prefix?: string }) | (NamedRef & { prefix?: string })[] | null },
  locale: Locale,
): string {
  const joined = unwrapJoin(doc.ref_registration_journals);
  if (!joined) return "—";
  const name = localized(joined as { name_ru: string; name_kk: string }, locale, "name");
  const prefix = (joined as { prefix?: string }).prefix;
  return prefix ? `${name} (${prefix})` : name;
}

export function deliveryMethodLabel(
  doc: { ref_delivery_methods?: NamedRef | NamedRef[] | null },
  locale: Locale,
): string {
  const joined = unwrapJoin(doc.ref_delivery_methods);
  if (joined) return localized(joined as { name_ru: string; name_kk: string }, locale, "name");
  return "—";
}
