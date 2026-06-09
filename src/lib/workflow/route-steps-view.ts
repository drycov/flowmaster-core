import type { WorkflowDefinition, WorkflowNode } from "@/components/workflow-designer/types";
import type { TFunction } from "@/i18n";
import type { AssigneeLookup } from "./assignee-display";
import { resolveNodeAssigneeLabel } from "./assignee-display";
import { linearStepsToDefinition, parseStoredCustomRoute } from "./route-builder";

export type RouteStepStatus =
  | "waiting"
  | "pending"
  | "in_progress"
  | "completed"
  | "rejected"
  | "cancelled"
  | "escalated";

export interface RouteStepView {
  id: string;
  order: number;
  label: string;
  nodeType: string;
  assigneeLabel: string;
  status: RouteStepStatus;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    assignee_id: string | null;
    due_at: string | null;
    completed_at?: string | null;
    decision?: string | null;
  }>;
}

const ACTIONABLE_TYPES = new Set(["APPROVAL", "SIGNATURE", "TASK", "NOTIFICATION"]);

export function resolveWorkflowDefinition(options: {
  customRoute?: unknown;
  workflowDefinition?: unknown;
  runContext?: unknown;
}): WorkflowDefinition | null {
  const { customRoute, workflowDefinition, runContext } = options;

  if (
    runContext &&
    typeof runContext === "object" &&
    Array.isArray((runContext as { nodes?: unknown }).nodes)
  ) {
    return runContext as WorkflowDefinition;
  }

  const parsed = parseStoredCustomRoute(customRoute);
  if (parsed.graph?.nodes?.length) return parsed.graph;
  if (parsed.steps?.length) {
    return linearStepsToDefinition(parsed.steps as Parameters<typeof linearStepsToDefinition>[0]);
  }

  if (
    workflowDefinition &&
    typeof workflowDefinition === "object" &&
    Array.isArray((workflowDefinition as { nodes?: unknown }).nodes)
  ) {
    return workflowDefinition as WorkflowDefinition;
  }

  if (typeof workflowDefinition === "string") {
    try {
      const parsedDef = JSON.parse(workflowDefinition) as WorkflowDefinition;
      if (Array.isArray(parsedDef.nodes)) return parsedDef;
    } catch {
      /* ignore */
    }
  }

  return null;
}

export function orderActionableNodes(def: WorkflowDefinition): WorkflowNode[] {
  const start = def.nodes?.find((n) => n.type === "START");
  if (!start) {
    return (def.nodes ?? []).filter((n) => ACTIONABLE_TYPES.has(n.type));
  }

  const byId = new Map((def.nodes ?? []).map((n) => [n.id, n]));
  const result: WorkflowNode[] = [];
  const visited = new Set<string>();
  const queue = [start.id];

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = byId.get(id);
    if (node && ACTIONABLE_TYPES.has(node.type)) {
      result.push(node);
    }

    for (const edge of def.edges ?? []) {
      if (edge.source === id && !visited.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  return result;
}

function aggregateTaskStatus(statuses: string[]): RouteStepStatus {
  if (statuses.some((s) => s === "rejected")) return "rejected";
  if (statuses.some((s) => s === "returned")) return "cancelled";
  if (statuses.some((s) => s === "cancelled")) return "cancelled";
  if (statuses.some((s) => s === "escalated")) return "escalated";
  if (statuses.length > 0 && statuses.every((s) => s === "completed")) return "completed";
  if (statuses.some((s) => s === "in_progress")) return "in_progress";
  if (statuses.some((s) => s === "pending")) return "pending";
  return "pending";
}

function resolveStepStatus(
  stepIndex: number,
  nodeId: string,
  orderedNodes: WorkflowNode[],
  tasks: Array<{ node_id: string; status: string }>,
  run: { status: string; current_node?: string | null } | null,
): RouteStepStatus {
  const nodeTasks = tasks.filter((t) => t.node_id === nodeId);
  if (nodeTasks.length > 0) {
    return aggregateTaskStatus(nodeTasks.map((t) => t.status));
  }

  if (!run) return "waiting";

  if (run.status === "completed") {
    return "completed";
  }

  if (run.status === "cancelled" || run.status === "failed") {
    const currentIdx = orderedNodes.findIndex((n) => n.id === run.current_node);
    if (currentIdx < 0) return "waiting";
    if (stepIndex < currentIdx) return "completed";
    if (stepIndex === currentIdx) return run.status === "failed" ? "rejected" : "cancelled";
    return "waiting";
  }

  const currentIdx = orderedNodes.findIndex((n) => n.id === run.current_node);
  if (currentIdx < 0) {
    const atStart = run.current_node?.toLowerCase() === "start";
    if (atStart) return stepIndex === 0 ? "pending" : "waiting";
    return "waiting";
  }

  if (stepIndex < currentIdx) return "completed";
  if (stepIndex === currentIdx) return "in_progress";
  return "waiting";
}

export function getNodeDisplayLabel(node: WorkflowNode, locale: string): string {
  const data = (node as { data?: Record<string, string> }).data;
  if (locale === "kk") {
    const kk = data?.name_kk || data?.label_kk;
    if (kk) return kk;
  }
  const ru = node.label || data?.name_ru || data?.label_ru || data?.label || data?.name;
  if (ru) return ru;
  return node.id;
}

export function buildRouteStepsView(options: {
  locale: string;
  customRoute?: unknown;
  workflowDefinition?: unknown;
  assigneeLookup: AssigneeLookup;
  t: TFunction;
  runs: Array<{ id: string; status: string; current_node?: string | null; context?: unknown }>;
  tasks: Array<{
    id: string;
    run_id: string;
    node_id: string;
    node_type: string;
    title: string;
    status: string;
    assignee_id: string | null;
    due_at: string | null;
    completed_at?: string | null;
    decision?: string | null;
  }>;
}): { runStatus: string | null; steps: RouteStepView[] } {
  const activeRun = options.runs.find((r) => r.status === "running") ?? options.runs[0] ?? null;

  const def = resolveWorkflowDefinition({
    customRoute: options.customRoute,
    workflowDefinition: options.workflowDefinition,
    runContext: activeRun?.context,
  });

  if (!def?.nodes?.length) {
    return { runStatus: activeRun?.status ?? null, steps: [] };
  }

  const ordered = orderActionableNodes(def);
  const runTasks = activeRun
    ? options.tasks.filter((t) => t.run_id === activeRun.id)
    : options.tasks;

  const steps: RouteStepView[] = ordered.map((node, index) => ({
    id: node.id,
    order: index + 1,
    label: getNodeDisplayLabel(node, options.locale),
    nodeType: node.type,
    assigneeLabel: resolveNodeAssigneeLabel(
      node,
      options.locale,
      options.assigneeLookup,
      options.t,
    ),
    status: resolveStepStatus(index, node.id, ordered, runTasks, activeRun),
    tasks: runTasks
      .filter((t) => t.node_id === node.id)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignee_id: t.assignee_id,
        due_at: t.due_at,
        completed_at: t.completed_at,
        decision: t.decision,
      })),
  }));

  return { runStatus: activeRun?.status ?? null, steps };
}
