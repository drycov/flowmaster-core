import type { QueryClient } from "@tanstack/react-query";
import { CATALOG_BRIEF_QUERY_KEYS } from "@/lib/references/catalogs";

/** Invalidate list + brief caches after catalog CRUD. */
export function invalidateCatalogQueries(qc: QueryClient, catalogId: string) {
  qc.invalidateQueries({ queryKey: ["ref-catalog", catalogId] });

  for (const key of CATALOG_BRIEF_QUERY_KEYS[catalogId] ?? []) {
    qc.invalidateQueries({ queryKey: [key] });
  }

  if (catalogId === "archive-locations") {
    qc.invalidateQueries({ queryKey: ["ref-locations-brief"] });
  }

  if (catalogId === "document-types") {
    qc.invalidateQueries({ queryKey: ["ref-catalog", "registration-journals"] });
  }
}
