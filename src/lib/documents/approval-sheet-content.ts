import type { WorkflowNode } from "@/components/workflow-designer/types";

export type ApprovalSheetRow = {
  order: number;
  stepLabel: string;
  nodeType: string;
  assigneeName: string;
  assigneePosition: string;
  decisionDate: string;
  signature: string;
  result: string;
};

export type ApprovalSheetDocumentInfo = {
  title: string;
  regNumber: string;
  documentDate: string;
  organizationName?: string;
};

const NODE_TYPE_LABELS: Record<string, string> = {
  APPROVAL: "Согласование",
  SIGNATURE: "Подписание",
  TASK: "Исполнение",
  NOTIFICATION: "Ознакомление",
};

export function approvalNodeTypeLabel(nodeType: string): string {
  return NODE_TYPE_LABELS[nodeType] ?? nodeType;
}

export function getNodeSheetLabel(node: WorkflowNode): string {
  const data = (node as { data?: Record<string, string> }).data;
  return (
    node.label?.trim() ||
    data?.label_ru?.trim() ||
    data?.name_ru?.trim() ||
    approvalNodeTypeLabel(node.type)
  );
}

export function buildApprovalSheetBody(
  doc: ApprovalSheetDocumentInfo,
  rows: ApprovalSheetRow[],
): string {
  const lines: string[] = [
    "ЛИСТ СОГЛАСОВАНИЯ",
    "",
    doc.organizationName ? doc.organizationName : "",
    doc.organizationName ? "" : undefined,
    `К документу: ${doc.title}`,
    `Рег. № ${doc.regNumber || "—"} от ${doc.documentDate}`,
    "",
    "┌────┬───────────────────────────┬─────────────────────────┬──────────────────────┬────────────┬────────────┬────────────┐",
    "│ №  │ Этап                      │ ФИО                     │ Должность            │ Дата       │ Подпись    │ Результат  │",
    "├────┼───────────────────────────┼─────────────────────────┼──────────────────────┼────────────┼────────────┼────────────┤",
  ].filter((line): line is string => line !== undefined);

  if (rows.length === 0) {
    lines.push(
      "│ —  │ Маршрут не содержит этапов согласования                                                          │",
    );
  } else {
    for (const row of rows) {
      lines.push(formatSheetRow(row));
    }
  }

  lines.push(
    "└────┴───────────────────────────┴─────────────────────────┴──────────────────────┴────────────┴────────────┴────────────┘",
  );

  return lines.join("\n");
}

function pad(value: string, width: number): string {
  const text = value.trim() || "—";
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}

function formatSheetRow(row: ApprovalSheetRow): string {
  return [
    "│",
    pad(String(row.order), 3),
    "│",
    pad(row.stepLabel, 26),
    "│",
    pad(row.assigneeName, 24),
    "│",
    pad(row.assigneePosition, 21),
    "│",
    pad(row.decisionDate, 11),
    "│",
    pad(row.signature, 11),
    "│",
    pad(row.result, 11),
    "│",
  ].join(" ");
}

export function buildApprovalSheetTitle(parentTitle: string): string {
  const base = parentTitle.trim() || "Документ";
  return `Лист согласования: ${base}`;
}
