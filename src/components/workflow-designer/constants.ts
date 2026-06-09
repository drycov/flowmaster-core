import type { NodeType } from "./types";
import type { CSSProperties } from "react";

export const NODE_TYPES: NodeType[] = [
  "START",
  "APPROVAL",
  "SIGNATURE",
  "TASK",
  "CONDITION",
  "FORK",
  "JOIN",
  "NOTIFICATION",
  "TIMER",
  "ESCALATION",
  "ARCHIVE",
  "END",
];

/** EDMS palette groups for the route designer */
export const NODE_PALETTE_GROUPS: { key: string; labelKey: string; types: NodeType[] }[] = [
  {
    key: "control",
    labelKey: "wf.palette.control",
    types: ["START", "END", "ARCHIVE"],
  },
  {
    key: "action",
    labelKey: "wf.palette.action",
    types: ["APPROVAL", "SIGNATURE", "TASK", "NOTIFICATION"],
  },
  {
    key: "routing",
    labelKey: "wf.palette.routing",
    types: ["CONDITION", "FORK", "JOIN"],
  },
  {
    key: "system",
    labelKey: "wf.palette.system",
    types: ["TIMER", "ESCALATION"],
  },
];

export const NODE_TYPE_LABEL_KEYS: Record<NodeType, string> = {
  START: "wf.node.START",
  APPROVAL: "wf.node.APPROVAL",
  SIGNATURE: "wf.node.SIGNATURE",
  TASK: "wf.node.TASK",
  CONDITION: "wf.node.CONDITION",
  FORK: "wf.node.FORK",
  JOIN: "wf.node.JOIN",
  NOTIFICATION: "wf.node.NOTIFICATION",
  TIMER: "wf.node.TIMER",
  ESCALATION: "wf.node.ESCALATION",
  ARCHIVE: "wf.node.ARCHIVE",
  END: "wf.node.END",
};

export const NODE_TYPE_ICONS: Partial<Record<NodeType, string>> = {
  START: "🚀",
  APPROVAL: "✓",
  SIGNATURE: "✍️",
  TASK: "📋",
  CONDITION: "🔀",
  FORK: "⑂",
  JOIN: "⑃",
  NOTIFICATION: "🔔",
  TIMER: "⏱️",
  ESCALATION: "⚠️",
  ARCHIVE: "📦",
  END: "🏁",
};

export const NODE_STYLE_BY_TYPE: Partial<Record<NodeType, CSSProperties>> = {
  START: { background: "#10b981", color: "white", border: "2px solid #059669" },
  END: { background: "#ef4444", color: "white", border: "2px solid #dc2626" },
  APPROVAL: { background: "#eff6ff", borderColor: "#3b82f6", border: "2px solid #3b82f6" },
  SIGNATURE: { background: "#fff7ed", borderColor: "#f97316", border: "2px solid #f97316" },
  TASK: { background: "#f8fafc", border: "2px solid #64748b" },
  ARCHIVE: { background: "#f3f4f6", border: "2px solid #6b7280" },
  CONDITION: { background: "#fefce8", borderColor: "#eab308", border: "2px solid #eab308" },
  FORK: { background: "#f0f9ff", borderColor: "#0ea5e9", border: "2px solid #0ea5e9" },
  JOIN: { background: "#f0fdf4", borderColor: "#22c55e", border: "2px solid #22c55e" },
  NOTIFICATION: { background: "#fef2f2", borderColor: "#ef4444", border: "2px solid #ef4444" },
  TIMER: { background: "#ecfdf5", borderColor: "#10b981", border: "2px solid #10b981" },
  ESCALATION: { background: "#fef3c7", borderColor: "#d97706", border: "2px solid #d97706" },
};

export const OPERATORS = [
  { id: "===", labelKey: "wf.op.equals" },
  { id: "!==", labelKey: "wf.op.notEquals" },
  { id: ">", labelKey: "wf.op.gt" },
  { id: "<", labelKey: "wf.op.lt" },
  { id: ">=", labelKey: "wf.op.gte" },
  { id: "<=", labelKey: "wf.op.lte" },
  { id: "includes", labelKey: "wf.op.includes" },
  { id: "startsWith", labelKey: "wf.op.startsWith" },
  { id: "endsWith", labelKey: "wf.op.endsWith" },
] as const;

export const DEFAULT_NODE_STYLE: CSSProperties = {
  padding: "12px 8px",
  borderRadius: 8,
  fontSize: 12,
  whiteSpace: "pre-wrap",
  minWidth: 140,
  textAlign: "center",
  fontWeight: 500,
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  cursor: "pointer",
};

export const DEFAULT_EDGE_STYLE = {
  strokeWidth: 2,
  stroke: "#64748b",
};

export const DEFAULT_EDGE_LABEL_STYLE = {
  fill: "#1e293b",
  fontSize: 12,
  fontWeight: 600,
};

export const DEFAULT_EDGE_LABEL_BG_STYLE = {
  fill: "#f8fafc",
  fillOpacity: 0.9,
  stroke: "#cbd5e1",
};
