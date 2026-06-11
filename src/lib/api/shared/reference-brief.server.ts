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

export async function queryDutyRolesBrief(
  supabase: SupabaseClient,
  departmentId?: string,
): Promise<ReferenceBriefRow[]> {
  let q = supabase
    .from("ref_duty_roles" as never)
    .select("id, code, name_ru, name_kk, color, department_id, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true });

  if (departmentId) {
    q = q.or(`department_id.is.null,department_id.eq.${departmentId}`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ReferenceBriefRow[];
}
