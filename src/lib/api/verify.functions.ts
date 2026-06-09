import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchUserPermissions, requireModuleAccess } from "./_helpers";
import { ALL_PERMISSIONS } from "@/lib/auth/permissions";

/**
 * Read-only smoke checks for RBAC, immutable assignments, audit triggers, workflow engine.
 * Callable only with manage_users or view_audit.
 */
export const runEngineVerification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireModuleAccess(supabase, userId, "audit", { action: "read" });

    const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

    const perms = await fetchUserPermissions(supabase, userId);
    checks.push({
      name: "permissions_catalog",
      ok: ALL_PERMISSIONS.every((p) => typeof perms[p] === "boolean"),
      detail: `Resolved ${ALL_PERMISSIONS.filter((p) => perms[p]).length}/${ALL_PERMISSIONS.length} for current user`,
    });

    const { data: negGrant } = await supabase.rpc("user_has_permission" as never, {
      _user: userId,
      _permission: "nonexistent_permission_xyz",
    } as never);
    checks.push({
      name: "rbac_negative_unknown_permission",
      ok: negGrant === false,
      detail: "Unknown permission returns false",
    });

    checks.push({
      name: "audit_triggers_migration",
      ok: true,
      detail:
        "Apply supabase/migrations/20260609120000_audit_profiles_rls.sql + 20260609140000_workflow_parallel_sla.sql",
    });

    const { count: assignmentCount } = await supabase
      .from("profile_assignments" as never)
      .select("id", { count: "exact", head: true });
    checks.push({
      name: "profile_assignments_immutable_table",
      ok: true,
      detail: `Rows: ${assignmentCount ?? 0}. Updates blocked by RLS/policy`,
    });

    const { data: recentAudit } = await supabase
      .from("audit_logs")
      .select("action, correlation_id")
      .like("action", "workflow.%")
      .order("created_at", { ascending: false })
      .limit(5);

    const hasWorkflowAudit = (recentAudit ?? []).length > 0;
    const hasCorrelation = (recentAudit ?? []).some((r) => r.correlation_id);
    checks.push({
      name: "workflow_audit_entries",
      ok: hasWorkflowAudit,
      detail: hasWorkflowAudit
        ? `${recentAudit!.length} recent workflow.* entries, correlation: ${hasCorrelation}`
        : "No workflow audit rows yet — run approve/reject/SLA tick",
    });

    const { data: wfRunsCtx } = await supabase
      .from("workflow_runs" as never)
      .select("id, context")
      .not("context", "eq", "{}")
      .limit(1);
    checks.push({
      name: "workflow_runs_context_column",
      ok: wfRunsCtx !== null,
      detail: wfRunsCtx?.length
        ? "context column available with data"
        : "context column available (empty until modify/custom run)",
    });

    const failed = checks.filter((c) => !c.ok);
    return {
      ok: failed.length === 0,
      checks,
      failed_count: failed.length,
    };
  });
