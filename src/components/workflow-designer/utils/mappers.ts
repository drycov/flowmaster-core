import type { WorkflowNode, WorkflowEdge, FlowNode, FlowEdge, NodeType } from "../types";
import { NODE_TYPE_LABELS, NODE_STYLE_BY_TYPE, DEFAULT_NODE_STYLE, DEFAULT_EDGE_STYLE } from "../constants";
import type { CSSProperties } from "react";

export const toFlowNode = (n: WorkflowNode): FlowNode => ({
  id: n.id,
  type: "default",
  position: n.position,
  data: {
    type: n.type,
    label: n.label || NODE_TYPE_LABELS[n.type as NodeType],
    description: n.description,
    assignee_id: n.assignee_id,
    assignee_type: n.assignee_type || "user",
    sla_hours: n.sla_hours ?? null,
    sla_unit: n.sla_unit || "hours",
    sla_working_hours_only: n.sla_working_hours_only || false,
    config: n.config,
  },
  style: {
    ...DEFAULT_NODE_STYLE,
    ...(NODE_STYLE_BY_TYPE[n.type as NodeType] || {}),
  } as CSSProperties,
});

export const toFlowEdge = (e: WorkflowEdge): FlowEdge => ({
  id: e.id,
  type: "default",
  source: e.source,
  target: e.target,
  label: e.label,
  data: { condition: e.condition },
  style: DEFAULT_EDGE_STYLE,
});

export const toDomainNode = (n: FlowNode): WorkflowNode => ({
  id: n.id,
  type: n.data.type,
  label: n.data.label,
  description: n.data.description,
  position: n.position,
  assignee_id: n.data.assignee_id ?? null,
  assignee_type: n.data.assignee_type,
  // Aliases consumed by SQL resolve_workflow_assignees(_node, _doc).
  assignee_mode: n.data.assignee_type,
  assignee_ref: n.data.assignee_id ?? null,
  sla_hours: n.data.sla_hours ?? undefined,
  sla_unit: n.data.sla_unit,
  sla_working_hours_only: n.data.sla_working_hours_only,
  config: {
    ...(n.data.config ?? {}),
    is_required: (n.data.config as { is_required?: boolean } | undefined)?.is_required ?? true,
    timeout_action:
      (n.data.config as { timeout_action?: string } | undefined)?.timeout_action ?? "notify",
    escalation_role:
      (n.data.config as { escalation_role?: string } | undefined)?.escalation_role ?? null,
  },
});



export const toDomainEdge = (e: FlowEdge): WorkflowEdge => ({
  id: e.id,
  source: e.source,
  target: e.target,
  label: typeof e.label === "string" ? e.label : undefined,
  condition: e.data?.condition,
});

export const createNewEdge = (connection: { source: string; target: string }): FlowEdge => ({
  id: `edge_${Date.now()}_${Math.random()}`,
  type: "default",
  source: connection.source,
  target: connection.target,
  style: DEFAULT_EDGE_STYLE,
});

export const createNewNode = (type: NodeType, position: { x: number; y: number }, label?: string): FlowNode => ({
  id: `node_${Date.now()}_${Math.random()}`,
  type: "default",
  position,
  data: {
    type,
    label: label || NODE_TYPE_LABELS[type],
    assignee_id: null,
    assignee_type: "user",
    sla_hours: null,
    sla_unit: "hours",
    sla_working_hours_only: false,
    config: {},
  },
  style: {
    ...DEFAULT_NODE_STYLE,
    ...(NODE_STYLE_BY_TYPE[type] || {}),
  } as CSSProperties,
});