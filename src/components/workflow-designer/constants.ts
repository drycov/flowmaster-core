import type { NodeType } from "./types";
import type { CSSProperties } from "react";

export const NODE_TYPES: NodeType[] = [
  "START",
  "APPROVAL",
  "SIGNATURE",
  "TASK",
  "CONDITION",
  "NOTIFICATION",
  "TIMER",
  "ESCALATION",
  "ARCHIVE",
  "END",
];

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  START: "Старт",
  APPROVAL: "Согласование",
  SIGNATURE: "Подписание",
  TASK: "Задача",
  CONDITION: "Условие",
  NOTIFICATION: "Уведомление",
  TIMER: "Таймер",
  ESCALATION: "Эскалация",
  ARCHIVE: "Архивация",
  END: "Завершение",
};

export const NODE_TYPE_ICONS: Partial<Record<NodeType, string>> = {
  START: "🚀",
  APPROVAL: "✓",
  SIGNATURE: "✍️",
  TASK: "📋",
  CONDITION: "🔀",
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
  NOTIFICATION: { background: "#fef2f2", borderColor: "#ef4444", border: "2px solid #ef4444" },
  TIMER: { background: "#ecfdf5", borderColor: "#10b981", border: "2px solid #10b981" },
  ESCALATION: { background: "#fef3c7", borderColor: "#d97706", border: "2px solid #d97706" },
};

export const OPERATORS = [
  { id: "===", label: "Равно" },
  { id: "!==", label: "Не равно" },
  { id: ">", label: "Больше" },
  { id: "<", label: "Меньше" },
  { id: ">=", label: "Больше или равно" },
  { id: "<=", label: "Меньше или равно" },
  { id: "includes", label: "Содержит" },
  { id: "startsWith", label: "Начинается с" },
  { id: "endsWith", label: "Заканчивается на" },
];

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