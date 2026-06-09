import type { WorkflowNode, WorkflowEdge, FlowNode, FlowEdge, NodeType } from "../types";

import { NODE_STYLE_BY_TYPE, DEFAULT_NODE_STYLE, DEFAULT_EDGE_STYLE } from "../constants";

import type { TFunction } from "@/i18n";

import { workflowNodeLabel } from "@/i18n/helpers";

import type { CSSProperties } from "react";



const resolveNodeLabel = (type: NodeType, stored?: string | null, t?: TFunction) =>

  stored?.trim() || (t ? workflowNodeLabel(t, type) : type);



export const toFlowNode = (n: WorkflowNode, t?: TFunction): FlowNode => ({

  id: n.id,

  type: "workflowNode",

  position: n.position,

  data: {

    type: n.type,

    label: resolveNodeLabel(n.type as NodeType, n.label, t),

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



export const toDomainNode = (n: FlowNode): WorkflowNode => {

  const cfg = {

    ...(n.data.config ?? {}),

    is_required: (n.data.config as { is_required?: boolean } | undefined)?.is_required ?? true,

    timeout_action:

      (n.data.config as { timeout_action?: string } | undefined)?.timeout_action ?? "notify",

    escalation_role:

      (n.data.config as { escalation_role?: string } | undefined)?.escalation_role ?? null,

    max_escalations:

      (n.data.config as { max_escalations?: number } | undefined)?.max_escalations ?? 5,

    sla_repeat_hours:

      (n.data.config as { sla_repeat_hours?: number } | undefined)?.sla_repeat_hours ?? 24,

  };

  return {

    id: n.id,

    type: n.data.type,

    label: n.data.label,

    description: n.data.description,

    position: n.position,

    assignee_id: n.data.assignee_id ?? null,

    assignee_type: n.data.assignee_type,

    assignee_mode: n.data.assignee_type,

    assignee_ref: n.data.assignee_id ?? null,

    sla_hours: n.data.sla_hours ?? undefined,

    sla_unit: n.data.sla_unit,

    sla_working_hours_only: n.data.sla_working_hours_only,

    config: {
      ...cfg,
      parallel_mode:
        (n.data.config as { parallel_mode?: string } | undefined)?.parallel_mode ?? "all",
      signature_provider:
        (n.data.config as { signature_provider?: string } | undefined)?.signature_provider ??
        "ncalayer",
    },

    data: {
      assignee_mode: n.data.assignee_type,
      assignee_ref: n.data.assignee_id ?? null,
      sla_hours: n.data.sla_hours,
      sla_unit: n.data.sla_unit,
      sla_working_hours_only: n.data.sla_working_hours_only,
      config: {
        ...cfg,
        parallel_mode:
          (n.data.config as { parallel_mode?: string } | undefined)?.parallel_mode ?? "all",
      },
    },
  } as WorkflowNode & { data?: Record<string, unknown> };

};







export const toDomainDefinition = (
  nodes: FlowNode[],
  edges: FlowEdge[],
): { nodes: WorkflowNode[]; edges: WorkflowEdge[]; schema_version: number } => ({
  nodes: nodes.map(toDomainNode),
  edges: edges.map(toDomainEdge),
  schema_version: 2,
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



export const createNewNode = (

  type: NodeType,

  position: { x: number; y: number },

  t?: TFunction,

  label?: string,

): FlowNode => ({

  id: `node_${Date.now()}_${Math.random()}`,

  type: "workflowNode",

  position,

  data: {

    type,

    label: label || resolveNodeLabel(type, null, t),

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

