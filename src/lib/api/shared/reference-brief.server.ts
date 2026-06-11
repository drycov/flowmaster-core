import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReferenceBriefRow } from "@/lib/api/reference-types";

export type { ReferenceBriefRow };

type OrderSpec = { column: string; ascending?: boolean };

export async function queryActiveReferenceBrief<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  order: OrderSpec[],
): Promise<T[]> {
  let q = supabase
    .from(table as never)
    .select(select)
    .eq("is_active", true);
  for (const spec of order) {
    q = q.order(spec.column, { ascending: spec.ascending ?? true });
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}
