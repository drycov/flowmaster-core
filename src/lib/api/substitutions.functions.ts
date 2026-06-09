import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceLicense } from "./_helpers";

export const listMySubstitutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const [asPrincipal, asSubstitute] = await Promise.all([
      supabase
        .from("user_substitutions")
        .select("id, principal_id, substitute_id, valid_from, valid_until, note, is_active, created_at")
        .eq("principal_id", userId)
        .order("valid_from", { ascending: false }),
      supabase
        .from("user_substitutions")
        .select("principal_id")
        .eq("substitute_id", userId)
        .eq("is_active", true)
        .lte("valid_from", now)
        .gte("valid_until", now),
    ]);

    if (asPrincipal.error) throw new Error(asPrincipal.error.message);
    if (asSubstitute.error) throw new Error(asSubstitute.error.message);

    return {
      records: asPrincipal.data ?? [],
      actingFor: (asSubstitute.data ?? []).map((r) => r.principal_id as string),
    };
  });

export const createSubstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      substitute_id: z.string().uuid(),
      valid_from: z.string(),
      valid_until: z.string(),
      note: z.string().max(500).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceLicense(context.supabase, { writable: true });
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("user_substitutions")
      .insert({
        principal_id: userId,
        substitute_id: data.substitute_id,
        valid_from: data.valid_from,
        valid_until: data.valid_until,
        note: data.note ?? null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const deactivateSubstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await enforceLicense(context.supabase, { writable: true });
    const { error } = await context.supabase
      .from("user_substitutions")
      .update({ is_active: false })
      .eq("id", data.id)
      .eq("principal_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
