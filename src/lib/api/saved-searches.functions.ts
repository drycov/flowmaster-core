import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { upsertRow } from "@/lib/api/db.helpers.server";

const querySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  scope: z.enum(["all", "mine", "assigned", "archive"]).optional(),
  document_type_code: z.string().optional(),
});

export type SavedSearchQuery = z.infer<typeof querySchema>;

export const listSavedSearches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_searches")
      .select("id, name, query, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(120),
      query: querySchema,
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = { name: data.name.trim(), query: data.query };

    if (data.id) {
      await upsertRow({
        supabase,
        table: "saved_searches",
        row: payload,
        id: data.id,
        updateEq: { user_id: userId },
      });
      return { id: data.id, ...payload };
    }

    const row = await upsertRow({
      supabase,
      table: "saved_searches",
      row: payload,
      insertOnly: { user_id: userId },
      select: "id, name, query",
    });
    return row as { id: string; name: string; query: SavedSearchQuery };
  });

export const deleteSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_searches")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
