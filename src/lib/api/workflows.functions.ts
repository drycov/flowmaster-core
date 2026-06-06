import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "./_helpers";

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
      definition: z.object({
        nodes: z.array(
          z.object({
            id: z.string(),
            type: z.string(),
            label: z.string().optional(),
            assignee_id: z.string().nullable().optional(),
            assignee_type: z.string().optional(),
            sla_hours: z.number().optional(),
            position: z.object({ x: z.number(), y: z.number() }).optional(),
            config: z.record(z.string(), z.unknown()).optional(),
          }),
        ),
        edges: z.array(
          z.object({ id: z.string(), source: z.string(), target: z.string(), label: z.string().optional() }),
        ),
      }),
    }),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase, context.userId, "manage_workflows");
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("workflows")
        .update({
          name_ru: data.name_ru,
          name_kk: data.name_kk,
          description: data.description ?? null,
          status: data.status,
          definition: data.definition,
        } as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("workflows")
      .insert({
        name_ru: data.name_ru,
        name_kk: data.name_kk,
        description: data.description ?? null,
        status: data.status,
        definition: data.definition,
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
  sla_hours?: number;
}
interface WfEdge {
  source: string;
  target: string;
}
interface WfDef {
  nodes: WfNode[];
  edges: WfEdge[];
}

function nextNode(def: WfDef, fromId: string): WfNode | null {
  const edge = def.edges.find((e) => e.source === fromId);
  if (!edge) return null;
  return def.nodes.find((n) => n.id === edge.target) ?? null;
}

async function createTaskForNode(
  supabase: any,
  runId: string,
  docId: string,
  node: WfNode,
  initiatorId: string,
) {
  if (!["APPROVAL", "SIGNATURE", "TASK", "NOTIFICATION"].includes(node.type)) return;

  let assigneeId = node.assignee_id ?? null;
  let roleCode = null;
  let departmentId = null;
  let isManager = false;

  const type = node.assignee_type || "user";

  if (type === "initiator_manager") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("department_id")
      .eq("id", initiatorId)
      .single();
    if (profile?.department_id) {
      const { data: dept } = await supabase
        .from("departments")
        .select("head_user_id")
        .eq("id", profile.department_id)
        .single();
      assigneeId = dept?.head_user_id || null;
    }
    isManager = true;
  } else if (type === "department_manager") {
    const { data: dept } = await supabase
      .from("departments")
      .select("head_user_id")
      .eq("id", node.assignee_id)
      .single();
    assigneeId = dept?.head_user_id || null;
    departmentId = node.assignee_id as string;
    isManager = true;
  } else if (type === "role") {
    roleCode = node.assignee_id;
    assigneeId = null;
  } else if (type === "department") {
    departmentId = node.assignee_id as string;
    assigneeId = null;
  }

  const due = node.sla_hours
    ? new Date(Date.now() + node.sla_hours * 3600_000).toISOString()
    : null;

  await supabase.from("workflow_tasks").insert({
    run_id: runId,
    document_id: docId,
    node_id: node.id,
    node_type: node.type,
    title: node.label || node.type,
    assignee_id: assigneeId,
    role_code: roleCode,
    department_id: departmentId,
    is_manager: isManager,
    action_required:
      node.type === "APPROVAL" ? "approve" : node.type === "SIGNATURE" ? "sign" : "review",
    due_at: due,
  });

  if (assigneeId) {
    await supabase.from("notifications").insert({
      user_id: assigneeId,
      type: "task",
      title: `Новая задача: ${node.label || node.type}`,
      body: null,
      link: `/documents/${docId}`,
    });
  }
}

export const startWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      workflow_id: z.string().uuid().nullable().optional(),
      custom_route: z
        .array(
          z.object({
            order: z.number().int().min(0),
            label: z.string().max(255).optional(),
            assignee_user_id: z.string().uuid().nullable().optional(),
            assignee_position_id: z.string().uuid().nullable().optional(),
            assignee_department_id: z.string().uuid().nullable().optional(),
            assignee_mode: z
              .enum(["user", "position", "department_head", "role"])
              .default("user"),
            assignee_role: z.string().max(64).nullable().optional(),
            sla_hours: z.number().int().min(0).max(8760).default(72),
            action: z.enum(["approve", "sign", "review"]).default("approve"),
          }),
        )
        .optional()
        .nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Get initiator
    const { data: doc } = await supabase
      .from("documents")
      .select("created_by")
      .eq("id", data.document_id)
      .single();
    const initiatorId = doc?.created_by || userId;

    // === CUSTOM ROUTE branch ===
    if (data.custom_route && data.custom_route.length > 0) {
      const nodes: WfNode[] = [
        { id: "start", type: "START", label: "Start" },
        ...data.custom_route
          .sort((a, b) => a.order - b.order)
          .map((step, idx) => ({
            id: `step-${idx}`,
            type: step.action === "sign" ? "SIGNATURE" : "APPROVAL",
            label: step.label || `Шаг ${idx + 1}`,
            assignee_id:
              step.assignee_mode === "user"
                ? step.assignee_user_id ?? null
                : step.assignee_mode === "role"
                  ? step.assignee_role ?? null
                  : (step.assignee_department_id ?? null),
            assignee_type:
              step.assignee_mode === "department_head"
                ? "department_manager"
                : step.assignee_mode === "role"
                  ? "role"
                  : step.assignee_mode === "position"
                    ? "position"
                    : "user",
            sla_hours: step.sla_hours,
          })),
        { id: "end", type: "END", label: "End" },
      ];
      const edges: WfEdge[] = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({ id: `e-${i}`, source: nodes[i].id, target: nodes[i + 1].id });
      }

      const { data: run, error } = await (supabase.from("workflow_runs") as any)
        .insert({
          workflow_id: null,
          document_id: data.document_id,
          current_node: nodes[1]?.id ?? "start",
          status: "running",
          context: { custom_route: data.custom_route, nodes, edges },
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      await supabase.from("workflow_events").insert({
        run_id: run.id,
        document_id: data.document_id,
        event_type: "workflow.started",
        node_id: "start",
        actor_id: userId,
        payload: { custom: true },
      } as never);
      await supabase.from("documents").update({ status: "in_review" as never }).eq("id", data.document_id);
      const first = nodes[1];
      if (first && first.type !== "END") {
        await createTaskForNode(supabase, run.id, data.document_id, first, initiatorId);
      }
      return { run_id: run.id };
    }

    // === STANDARD WORKFLOW branch ===
    if (!data.workflow_id) throw new Error("workflow_id or custom_route is required");
    const wf = await supabase
      .from("workflows")
      .select("definition")
      .eq("id", data.workflow_id)
      .single();
    if (wf.error) throw new Error(wf.error.message);
    const def = wf.data.definition as unknown as WfDef;
    const start = def.nodes.find((n) => n.type === "START");
    if (!start) throw new Error("No START node");
    const first = nextNode(def, start.id);
    const { data: run, error } = await supabase
      .from("workflow_runs")
      .insert({
        workflow_id: data.workflow_id,
        document_id: data.document_id,
        current_node: first?.id ?? start.id,
        status: "running",
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("workflow_events").insert({
      run_id: run.id,
      document_id: data.document_id,
      event_type: "workflow.started",
      node_id: start.id,
      actor_id: userId,
      payload: {},
    } as never);
    await supabase.from("documents").update({ status: "in_review" as never }).eq("id", data.document_id);
    if (first) await createTaskForNode(supabase, run.id, data.document_id, first, initiatorId);
    return { run_id: run.id };
  });

// ============== ADVANCE TASK ==============
export const completeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      task_id: z.string().uuid(),
      decision: z.enum(["approve", "reject"]),
      comment: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const task = await supabase
      .from("workflow_tasks")
      .select("*, workflow_runs!inner(workflow_id)")
      .eq("id", data.task_id)
      .single();
    if (task.error) throw new Error(task.error.message);
    if (task.data.assignee_id !== userId)
      throw new Error("Not the assignee");
    await supabase
      .from("workflow_tasks")
      .update({
        status: data.decision === "approve" ? "completed" : "rejected",
        decision: data.decision,
        comment: data.comment ?? null,
        completed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.task_id);
    await supabase.from("workflow_events").insert({
      run_id: task.data.run_id,
      document_id: task.data.document_id,
      event_type: `task.${data.decision}`,
      node_id: task.data.node_id,
      actor_id: userId,
      payload: { comment: data.comment },
    } as never);

    if (data.decision === "reject") {
      await supabase
        .from("workflow_runs")
        .update({ status: "cancelled", completed_at: new Date().toISOString() } as never)
        .eq("id", task.data.run_id);
      await supabase
        .from("documents")
        .update({ status: "rejected" as never })
        .eq("id", task.data.document_id);
      return { ok: true, next: null };
    }

    // advance
    const wfId = (task.data as { workflow_runs: { workflow_id: string } }).workflow_runs.workflow_id;
    const wf = await supabase.from("workflows").select("definition").eq("id", wfId).single();
    const def = wf.data?.definition as unknown as WfDef;
    const next = def ? nextNode(def, task.data.node_id) : null;

    // Get initiator ID
    const { data: doc } = await supabase.from("documents").select("created_by").eq("id", task.data.document_id).single();
    const initiatorId = doc?.created_by || userId;

    if (!next || next.type === "END" || next.type === "ARCHIVE") {
      await supabase
        .from("workflow_runs")
        .update({
          status: "completed",
          current_node: next?.id ?? null,
          completed_at: new Date().toISOString(),
        } as never)
        .eq("id", task.data.run_id);
      const finalStatus = next?.type === "ARCHIVE" ? "archived" : "approved";
      await supabase
        .from("documents")
        .update({ status: finalStatus as never })
        .eq("id", task.data.document_id);
      return { ok: true, next: null };
    }
    await supabase
      .from("workflow_runs")
      .update({ current_node: next.id } as never)
      .eq("id", task.data.run_id);
    await createTaskForNode(supabase, task.data.run_id, task.data.document_id, next, initiatorId);
    return { ok: true, next: next.id };
  });

// ============== MY TASKS ==============
export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("workflow_tasks")
      .select("*, documents(id, reg_number, title_ru, title_kk, status)")
      .eq("assignee_id", context.userId)
      .in("status", ["pending", "in_progress"])
      .order("due_at", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });