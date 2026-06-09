import type { Edge, Node } from "@xyflow/react";

export type NodeType =
  | "START"
  | "APPROVAL"
  | "SIGNATURE"
  | "TASK"
  | "CONDITION"
  | "FORK"
  | "JOIN"
  | "NOTIFICATION"
  | "TIMER"
  | "ESCALATION"
  | "ARCHIVE"
  | "END";

export type AssigneeType =
  | "user"
  | "position"
  | "department"
  | "department_head"
  | "parent_department_head"
  | "initiator_manager"
  | "role"
  | "group";

export type WorkflowStatus = "draft" | "published" | "archived";
export type SlaUnit = "hours" | "business_days";

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label?: string;
  description?: string;
  position: { x: number; y: number };
  assignee_id?: string | null;
  assignee_type?: AssigneeType;
  assignee_mode?: AssigneeType;
  assignee_ref?: string | null;
  sla_hours?: number;
  sla_unit?: SlaUnit;
  sla_working_hours_only?: boolean;
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  schema_version?: number;
}

// Для ReactFlow data поле должно быть индексируемым
export interface WorkflowNodeData extends Record<string, unknown> {
  type: NodeType;
  label?: string;
  description?: string;
  assignee_id?: string | null;
  assignee_type?: AssigneeType;
  sla_hours?: number | null;
  sla_unit?: SlaUnit;
  sla_working_hours_only?: boolean;
  config?: Record<string, unknown>;
}

export interface WorkflowEdgeData extends Record<string, unknown> {
  condition?: string;
}

// Переопределяем типы для ReactFlow
export type FlowNode = Node<WorkflowNodeData>;
export type FlowEdge = Edge<WorkflowEdgeData>;

// API Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department_id?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
}

export interface DocumentField {
  id: string;
  label: string;
  type: "string" | "number" | "boolean" | "date";
}

export interface ComboboxOption {
  value: string;
  label: string;
  metadata?: unknown;
}
