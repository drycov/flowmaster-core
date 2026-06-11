import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireModuleAccess } from "../_helpers";

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        entity_type: z.string().optional(),
        entity_id: z.string().optional(),
        limit: z.number().max(500).default(100),
      })
      .optional(),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "audit", { action: "read" });
    let q = context.supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.entity_type) q = q.eq("entity_type", data.entity_type);
    if (data?.entity_id) q = q.eq("entity_id", data.entity_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const actorIds = Array.from(
      new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean) as string[]),
    );
    const profileMap = new Map<string, { full_name_ru: string | null; email: string }>();
    if (actorIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name_ru, email")
        .in("id", actorIds);
      (profs ?? []).forEach((p) =>
        profileMap.set(p.id, { full_name_ru: p.full_name_ru, email: p.email }),
      );
    }

    return (rows ?? []).map((r) => ({
      ...r,
      actor: r.actor_id ? (profileMap.get(r.actor_id) ?? null) : null,
    }));
  });
