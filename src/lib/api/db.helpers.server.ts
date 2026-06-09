import type { SupabaseClient } from "@supabase/supabase-js";

type UpsertRowOptions<T extends Record<string, unknown>> = {
  supabase: SupabaseClient;
  table: string;
  row: T;
  id?: string;
  onConflict?: string;
  insertOnly?: Record<string, unknown>;
  updateEq?: Record<string, string>;
  select?: string;
};

export async function upsertRow<T extends Record<string, unknown>>(
  opts: UpsertRowOptions<T>,
): Promise<Record<string, unknown>> {
  const { supabase, table, row, id, onConflict, insertOnly, updateEq, select = "id" } = opts;

  if (id) {
    const { id: _omit, ...patch } = row;
    void _omit;
    let q = supabase.from(table as never).update(patch as never).eq("id", id);
    for (const [key, value] of Object.entries(updateEq ?? {})) {
      q = q.eq(key, value);
    }
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { id, ...patch };
  }

  if (!onConflict) {
    const { id: _omit, ...insertRow } = row;
    void _omit;
    const { data, error } = await supabase
      .from(table as never)
      .insert({ ...insertRow, ...insertOnly } as never)
      .select(select)
      .single();
    if (error) throw new Error(error.message);
    return data as Record<string, unknown>;
  }

  const { id: _omit, ...insertRow } = row;
  void _omit;
  const { data, error } = await supabase
    .from(table as never)
    .upsert({ ...insertRow, ...insertOnly } as never, { onConflict })
    .select(select)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? { ...insertRow, ...insertOnly }) as Record<string, unknown>;
}
