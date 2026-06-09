import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireModuleAccess } from "./_helpers";

export type EdmsReports = {
  period_days: number;
  generated_at: string;
  documents_by_status: Array<{ status: string; count: number }>;
  documents_by_type: Array<{ code: string; name_ru: string; name_kk: string; count: number }>;
  documents_timeline: Array<{ day: string; count: number }>;
  sla_summary: { ok: number; warning: number; overdue: number };
  workflow_tasks: {
    pending: number;
    completed: number;
    rejected: number;
    returned: number;
    avg_completion_hours: number | null;
  };
  correspondence: { incoming: number; outgoing: number; internal: number };
  archive: { archived: number; legal_hold: number; expiring_30d: number };
  totals: { documents: number; created_in_period: number };
};

export const getEdmsReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ days: z.number().int().min(7).max(365).default(30) }).optional())
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireModuleAccess(supabase, userId, "reports", { action: "read" });

    const days = data?.days ?? 30;
    const { data: result, error } = await supabaseAdmin.rpc(
      "get_edms_reports" as never,
      {
        _user: userId,
        _days: days,
      } as never,
    );

    if (error) throw new Error(error.message);
    return result as EdmsReports;
  });
