import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { upsertRow } from "@/lib/api/db.helpers.server";
import { enforceModuleLicense, requireModuleAccess } from "./_helpers";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  parseStoredCustomRoute,
  findStartNodeId,
  linearStepsToDefinition,
  type WorkflowDefinition,
} from "@/lib/workflow/route-builder";
import { customRouteStepSchema, graphDefinitionSchema } from "@/lib/workflow/custom-route-schema";
import { workflowDefinitionSchema } from "@/lib/workflow/workflow-schema";

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
        data.bump_version ||
        (data.status === "published" && prevStatus !== "published");
      version = shouldBump ? prevVersion + 1 : prevVersion;
    }

    const definition = {
      ...data.definition,
      schema_version: data.definition.schema_version ?? 2,
    };

    if (data.id) {
      const { error } = await supabase
        .from("workflows")
        .update({
          name_ru: data.name_ru,
          name_kk: data.name_kk,
          description: data.description ?? null,
          status: data.status,
          definition,
          version,
        } as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, version };
    }
    const { data: row, error } = await supabase
      .from("workflows")
      .insert({
        name_ru: data.name_ru,
        name_kk: data.name_kk,
        description: data.description ?? null,
        status: data.status,
        definition,
        version,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
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
  const start = (def.nodes as WfNode[]).find((n) => n.type === "START");
  if (!start) throw new Error("No START node");
  const { error } = await supabaseAdmin.rpc("wf_advance_from_node", {
    _run_id: runId,
    _doc_id: docId,
    _from_node_id: start.id,
    _nodes: def.nodes,
    _edges: def.edges,
  });
  if (error) throw new Error(error.message);
}

export const startWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      workflow_id: z.string().uuid().nullable().optional(),
      custom_route: z.union([z.array(customRouteStepSchema), graphDefinitionSchema]).optional().nullable(),
      graph_definition: graphDefinitionSchema.optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceModuleLicense(context.supabase, "workflows", "write");
    const { supabase, userId } = context;

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("created_by, workflow_id, custom_route, status")
      .eq("id", data.document_id)
      .single();
    if (docErr) throw new Error(docErr.message);

    const { data: canManage, error: canErr } = await supabase.rpc(
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

    let workflowId = data.workflow_id ?? doc.workflow_id ?? null;
    let graphDef: WorkflowDefinition | null = data.graph_definition as WorkflowDefinition | null;
    let customSteps: Array<z.infer<typeof customRouteStepSchema>> | null = null;

    if (Array.isArray(data.custom_route)) {
      customSteps = data.custom_route;
    } else if (
      data.custom_route &&
      typeof data.custom_route === "object" &&
      Array.isArray((data.custom_route as { nodes?: unknown }).nodes)
    ) {
      const g = data.custom_route as WorkflowDefinition;
      graphDef = { nodes: g.nodes as WorkflowDefinition["nodes"], edges: g.edges ?? [] };
    }

    if (!graphDef && !customSteps && doc.custom_route) {
      const parsed = parseStoredCustomRoute(doc.custom_route);
      graphDef = parsed.graph;
      customSteps = parsed.steps as Array<z.infer<typeof customRouteStepSchema>> | null;
    }

    async function insertRunAndStart(
      def: { nodes: unknown[]; edges: unknown[] },
      opts: { workflow_id: string | null; payload?: Record<string, unknown> },
    ) {
      const startId = findStartNodeId(def as WorkflowDefinition);
      const { data: run, error } = await (supabase.from("workflow_runs") as any)
        .insert({
          workflow_id: opts.workflow_id,
          document_id: data.document_id,
          current_node: startId,
          status: "running",
          context: def,
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
      await supabase.from("documents").update({ status: "in_review" as never }).eq("id", data.document_id);
      await advanceFromStart(run.id, data.document_id, def);
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
        { nodes: built.nodes, edges: built.edges, custom_route: customSteps },
        { workflow_id: null, payload: { custom: true } },
      );
      return { run_id: runId };
    }

    // === STANDARD WORKFLOW branch ===
    if (!workflowId) throw new Error("workflow_id, custom_route или graph_definition обязателен");
    const wf = await supabase
      .from("workflows")
      .select("definition")
      .eq("id", workflowId)
      .single();
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

// ============== ADVANCE TASK ==============
export const completeTask = createServerFn({ method: "POST" })
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
    const { data: res, error } = await supabase.rpc("app_advance_workflow_task" as never, {
      _task_id: data.task_id,
      _decision: data.decision,
      _comment: data.comment ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return res as { ok: boolean; next: string | null; correlation_id: string };
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

    let principalMap = new Map<string, { id: string; full_name_ru: string; full_name_kk: string; email: string }>();
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
        substitute_principal: isSubstitute ? (principalMap.get(assigneeId) ?? { id: assigneeId }) : null,
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
    const { data: res, error } = await context.supabase.rpc("delegate_workflow_task" as never, {
      _task_id: data.task_id,
      _to_user: data.to_user_id,
      _comment: data.comment ?? null,
    } as never);
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
    const { data: res, error } = await supabase.rpc("app_advance_workflow_task" as never, {
      _task_id: data.task_id,
      _decision: data.decision,
      _comment: data.comment ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return res as { ok: boolean; next: string | null; correlation_id: string };
  });
