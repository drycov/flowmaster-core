import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { upsertRow } from "@/lib/api/db.helpers.server";
import { enforceModuleLicense, requireModuleAccess } from "./_helpers";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  findStartNodeId,
  linearStepsToDefinition,
  normalizeWorkflowDefinition,
  type WorkflowDefinition,
} from "@/lib/workflow/route-builder";
import { resolveStartWorkflowRoute } from "@/lib/workflow/start-route.server";
import { customRouteStepSchema, graphDefinitionSchema } from "@/lib/workflow/custom-route-schema";
import { workflowDefinitionSchema } from "@/lib/workflow/workflow-schema";
import type { Json } from "@/integrations/supabase/types";

// ============== WORKFLOW DEFINITIONS ==============
export const listWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("workflows")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workflows")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      name_ru: z.string().min(1),
      name_kk: z.string().min(1),
      description: z.string().optional().nullable(),
      status: z.enum(["draft", "published", "archived"]).default("draft"),
      definition: workflowDefinitionSchema,
      bump_version: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "workflows", { action: "manage" });
    const { supabase, userId } = context;

    let version = 1;
    if (data.id) {
      const { data: existing } = await supabase
        .from("workflows")
        .select("version, status")
        .eq("id", data.id)
        .maybeSingle();
      const prevVersion = (existing as { version?: number } | null)?.version ?? 1;
      const prevStatus = (existing as { status?: string } | null)?.status;
      const shouldBump =
        data.bump_version || (data.status === "published" && prevStatus !== "published");
      version = shouldBump ? prevVersion + 1 : prevVersion;
    }

    const definition = {
      ...data.definition,
      schema_version: data.definition.schema_version ?? 2,
    };

    const row = await upsertRow({
      supabase,
      table: "workflows",
      row: {
        name_ru: data.name_ru,
        name_kk: data.name_kk,
        description: data.description ?? null,
        status: data.status,
        definition,
        version,
      },
      id: data.id,
      insertOnly: { created_by: userId },
    });
    return { id: String(row.id), version };
  });

// ============== START RUN ==============
interface WfNode {
  id: string;
  type: string;
  label?: string;
  assignee_id?: string | null;
  assignee_type?: string;
  assignee_mode?: string;
  assignee_ref?: string | null;
  sla_hours?: number;
  data?: Record<string, unknown>;
}
interface WfEdge {
  id?: string;
  source: string;
  target: string;
}
interface WfDef {
  nodes: WfNode[];
  edges: WfEdge[];
}

async function advanceFromStart(
  runId: string,
  docId: string,
  def: { nodes: unknown[]; edges: unknown[] },
) {
  const normalized = normalizeWorkflowDefinition(def as WorkflowDefinition);
  const start = normalized.nodes.find((n) => n.type === "START");
  if (!start) throw new Error("No START node");
  const { error } = await supabaseAdmin.rpc("wf_advance_from_node", {
    _run_id: runId,
    _doc_id: docId,
    _from_node_id: start.id,
    _nodes: normalized.nodes as Json,
    _edges: normalized.edges as Json,
  });
  if (error) {
    if (error.message.includes("has no assignees")) {
      throw new Error(
        "У этапа маршрута не назначен исполнитель. Откройте маршрут в редакторе и укажите, кто должен согласовать или подписать документ.",
      );
    }
    throw new Error(error.message);
  }
}

export const startWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      workflow_id: z.string().uuid().nullable().optional(),
      custom_route: z
        .union([z.array(customRouteStepSchema), graphDefinitionSchema])
        .optional()
        .nullable(),
      graph_definition: graphDefinitionSchema.optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceModuleLicense(context.supabase, "workflows", "write");
    const { supabase, userId } = context;

    const { data: doc, error: docErr } = await supabase
      .from("documents_full" as never)
      .select("created_by, status")
      .eq("id" as never, data.document_id)
      .single();
    if (docErr) throw new Error(docErr.message);

    const { data: canManage, error: canErr } = await supabaseAdmin.rpc(
      "can_manage_document_workflow" as never,
      { _doc_id: data.document_id, _user: userId } as never,
    );
    if (canErr) throw new Error(canErr.message);
    if (!canManage) throw new Error("Нет права запускать маршрут для этого документа");

    const { data: activeRun } = await supabase
      .from("workflow_runs")
      .select("id")
      .eq("document_id", data.document_id)
      .eq("status", "running")
      .maybeSingle();
    if (activeRun) throw new Error("Маршрут уже запущен для этого документа");

    const { workflowId, graphDef, customSteps } = await resolveStartWorkflowRoute(
      supabase,
      data.document_id,
      data,
    );

    async function insertRunAndStart(
      def: { nodes: unknown[]; edges: unknown[] },
      opts: { workflow_id: string | null; payload?: Record<string, unknown> },
    ) {
      const normalized = normalizeWorkflowDefinition(def as WorkflowDefinition);
      const startId = findStartNodeId(normalized);
      const { data: run, error } = await (supabase.from("workflow_runs") as any)
        .insert({
          workflow_id: opts.workflow_id,
          document_id: data.document_id,
          current_node: startId,
          status: "running",
          context: normalized,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      await supabase.from("workflow_events").insert({
        run_id: run.id,
        document_id: data.document_id,
        event_type: "workflow.started",
        node_id: startId,
        actor_id: userId,
        payload: opts.payload ?? {},
      } as never);
      await supabase
        .from("documents")
        .update({ status: "in_review" as never })
        .eq("id", data.document_id);
      await advanceFromStart(run.id, data.document_id, normalized);
      return run.id as string;
    }

    // === GRAPH DEFINITION (modify / stored graph) ===
    if (graphDef?.nodes?.length) {
      const runId = await insertRunAndStart(graphDef, {
        workflow_id: workflowId,
        payload: { modified: true, source: "graph" },
      });
      return { run_id: runId };
    }

    // === CUSTOM ROUTE branch (linear steps) ===
    if (customSteps && customSteps.length > 0) {
      const built = linearStepsToDefinition(customSteps);
      const runId = await insertRunAndStart(
        { nodes: built.nodes, edges: built.edges },
        { workflow_id: null, payload: { custom: true } },
      );
      return { run_id: runId };
    }

    // === STANDARD WORKFLOW branch ===
    if (!workflowId) {
      throw new Error(
        "Не задан маршрут согласования. Выберите маршрут в диалоге или задайте его при создании документа.",
      );
    }
    const wf = await supabase.from("workflows").select("definition").eq("id", workflowId).single();
    if (wf.error) throw new Error(wf.error.message);
    const def = wf.data.definition as unknown as WfDef;
    const start = def.nodes.find((n) => n.type === "START");
    if (!start) throw new Error("No START node");

    const runId = await insertRunAndStart(def, {
      workflow_id: workflowId,
      payload: { source: "workflow" },
    });
    return { run_id: runId };
  });

// ============== MY TASKS ==============
export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const { data: subs } = await supabase
      .from("user_substitutions")
      .select("principal_id")
      .eq("substitute_id", userId)
      .eq("is_active", true)
      .lte("valid_from", now)
      .gte("valid_until", now);

    const principalIds = (subs ?? []).map((s) => s.principal_id as string);
    const assigneeFilter =
      principalIds.length > 0
        ? `assignee_id.eq.${userId},assignee_id.in.(${principalIds.join(",")})`
        : `assignee_id.eq.${userId}`;

    const { data, error } = await supabase
      .from("workflow_tasks")
      .select("*, documents(id, reg_number, title_ru, title_kk, status)")
      .or(assigneeFilter)
      .in("status", ["pending", "in_progress"])
      .order("due_at", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);

    let principalMap = new Map<
      string,
      { id: string; full_name_ru: string; full_name_kk: string; email: string }
    >();
    if (principalIds.length > 0) {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name_ru, full_name_kk, email")
        .in("id", principalIds);
      if (pErr) throw new Error(pErr.message);
      principalMap = new Map((profiles ?? []).map((p) => [p.id as string, p as never]));
    }

    return (data ?? []).map((task) => {
      const assigneeId = task.assignee_id as string;
      const isSubstitute = assigneeId !== userId;
      return {
        ...task,
        is_substitute: isSubstitute,
        substitute_principal: isSubstitute
          ? (principalMap.get(assigneeId) ?? { id: assigneeId })
          : null,
      };
    });
  });

export const delegateWorkflowTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      task_id: z.string().uuid(),
      to_user_id: z.string().uuid(),
      comment: z.string().max(500).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceModuleLicense(context.supabase, "workflows", "write");
    const { data: res, error } = await supabaseAdmin.rpc(
      "delegate_workflow_task" as never,
      {
        _task_id: data.task_id,
        _to_user: data.to_user_id,
        _comment: data.comment ?? null,
      } as never,
    );
    if (error) throw new Error(error.message);
    return res;
  });

// ============== ADVANCE (approve / reject / return) ==============
export const advanceWorkflowTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      task_id: z.string().uuid(),
      decision: z.enum(["approve", "reject", "return"]),
      comment: z.string().max(4000).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceModuleLicense(context.supabase, "workflows", "write");
    const { supabase } = context;
    if (data.decision !== "approve" && !data.comment?.trim()) {
      throw new Error("Комментарий обязателен для отклонения или возврата");
    }
    const { data: res, error } = await supabaseAdmin.rpc(
      "app_advance_workflow_task" as never,
      {
        _task_id: data.task_id,
        _decision: data.decision,
        _comment: data.comment ?? null,
      } as never,
    );
    if (error) throw new Error(error.message);
    return res as { ok: boolean; next: string | null; correlation_id: string };
  });
