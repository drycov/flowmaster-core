import type { z } from "zod";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
} from "@/components/workflow-designer/types";
import type { graphDefinitionSchema } from "@/lib/workflow/custom-route-schema";

export type { WorkflowDefinition, WorkflowNode, WorkflowEdge };

export type ModifyNodeOverride = {
  id: string;
  enabled: boolean;
  label?: string;
  assignee_mode?: string;
  assignee_ref?: string | null;
  sla_hours?: number;
};

const ACTIONABLE_TYPES: NodeType[] = ["APPROVAL", "SIGNATURE", "TASK", "NOTIFICATION"];

export type StoredCustomRoute =
  | Array<Record<string, unknown>>
  | { nodes: WorkflowNode[]; edges: WorkflowEdge[]; kind?: string };

export function parseStoredCustomRoute(raw: unknown): {
  steps: Array<Record<string, unknown>> | null;
  graph: WorkflowDefinition | null;
} {
  if (!raw) return { steps: null, graph: null };
  if (Array.isArray(raw)) return { steps: raw, graph: null };
  if (
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { nodes?: unknown }).nodes)
  ) {
    const g = raw as { nodes: WorkflowNode[]; edges?: WorkflowEdge[] };
    return {
      steps: null,
      graph: { nodes: g.nodes, edges: g.edges ?? [] },
    };
  }
  return { steps: null, graph: null };
}

export function findStartNodeId(def: WorkflowDefinition): string {
  const start = def.nodes?.find((n) => n.type === "START");
  return start?.id ?? "start";
}

export function extractActionableNodes(def: WorkflowDefinition): WorkflowNode[] {
  return (def.nodes ?? []).filter((n) => ACTIONABLE_TYPES.includes(n.type as NodeType));
}

export function buildModifiedDefinition(
  base: WorkflowDefinition,
  overrides: ModifyNodeOverride[],
): WorkflowDefinition {
  const overrideMap = new Map(overrides.map((o) => [o.id, o]));
  const disabled = new Set(overrides.filter((o) => !o.enabled).map((o) => o.id));

  const nodes = (base.nodes ?? [])
    .filter((n) => {
      if (n.type === "START" || n.type === "END" || n.type === "ARCHIVE") return true;
      if (n.type === "FORK" || n.type === "JOIN" || n.type === "CONDITION") return true;
      return !disabled.has(n.id);
    })
    .map((n) => {
      const o = overrideMap.get(n.id);
      if (!o) return n;
      return {
        ...n,
        label: o.label ?? n.label,
        assignee_mode: (o.assignee_mode as WorkflowNode["assignee_mode"]) ?? n.assignee_mode,
        assignee_type: (o.assignee_mode as WorkflowNode["assignee_type"]) ?? n.assignee_type,
        assignee_ref: o.assignee_ref !== undefined ? o.assignee_ref : n.assignee_ref,
        assignee_id: o.assignee_ref !== undefined ? o.assignee_ref : n.assignee_id,
        sla_hours: o.sla_hours ?? n.sla_hours,
        data: {
          ...(n as { data?: Record<string, unknown> }).data,
          assignee_mode: o.assignee_mode ?? n.assignee_mode,
          assignee_ref: o.assignee_ref ?? n.assignee_ref,
          sla_hours: o.sla_hours ?? n.sla_hours,
        },
      };
    });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = (base.edges ?? []).filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  return pruneUnreachable({ nodes, edges });
}

function pruneUnreachable(def: WorkflowDefinition): WorkflowDefinition {
  const start = def.nodes.find((n) => n.type === "START");
  if (!start) return def;

  const reachable = new Set<string>();
  const queue = [start.id];
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    def.edges.filter((e) => e.source === id).forEach((e) => queue.push(e.target));
  }

  return {
    nodes: def.nodes.filter((n) => reachable.has(n.id)),
    edges: def.edges.filter((e) => reachable.has(e.source) && reachable.has(e.target)),
  };
}

export function linearStepsToDefinition(
  steps: Array<{
    order: number;
    label?: string;
    assignee_mode: string;
    assignee_user_id?: string | null;
    assignee_position_id?: string | null;
    assignee_department_id?: string | null;
    assignee_role?: string | null;
    sla_hours: number;
    action: string;
  }>,
): WorkflowDefinition {
  const nodes: WorkflowNode[] = [
    { id: "start", type: "START", label: "Start", position: { x: 0, y: 0 } },
    ...steps
      .sort((a, b) => a.order - b.order)
      .map((s, idx) => ({
        id: `step-${idx}`,
        type: (s.action === "sign" ? "SIGNATURE" : "APPROVAL") as NodeType,
        label: s.label || `Шаг ${idx + 1}`,
        position: { x: 0, y: (idx + 1) * 80 },
        assignee_mode: s.assignee_mode as WorkflowNode["assignee_mode"],
        assignee_type: s.assignee_mode as WorkflowNode["assignee_type"],
        assignee_ref:
          s.assignee_mode === "user"
            ? (s.assignee_user_id ?? null)
            : s.assignee_mode === "position"
              ? (s.assignee_position_id ?? null)
              : s.assignee_mode === "role"
                ? (s.assignee_role ?? null)
                : (s.assignee_department_id ?? null),
        assignee_id:
          s.assignee_mode === "user"
            ? (s.assignee_user_id ?? null)
            : (s.assignee_department_id ?? null),
        sla_hours: s.sla_hours,
      })),
    { id: "end", type: "END", label: "End", position: { x: 0, y: (steps.length + 1) * 80 } },
  ];

  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `e-${i}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
    });
  }

  return { nodes, edges };
}

export type GraphRouteInput = z.infer<typeof graphDefinitionSchema>;

export function toGraphRouteInput(def: WorkflowDefinition | null | undefined): GraphRouteInput | null {
  if (!def?.nodes?.length) return null;
  return {
    nodes: def.nodes as unknown as Record<string, unknown>[],
    edges: def.edges ?? [],
    kind: "graph",
    schema_version: def.schema_version,
  };
}
