import type { DocumentField } from "@/components/workflow-designer/types";

/** Standard EDMS document attributes for workflow edge conditions */
export const EDMS_DOCUMENT_FIELDS: DocumentField[] = [
  { id: "status", label: "Статус документа", type: "string" },
  { id: "document_type_code", label: "Вид документа (код)", type: "string" },
  { id: "priority_code", label: "Приоритет (код)", type: "string" },
  { id: "department_code", label: "Подразделение (код)", type: "string" },
  { id: "doc_type", label: "Тип (legacy)", type: "string" },
  { id: "sla_status", label: "Статус SLA", type: "string" },
  { id: "legal_hold", label: "Legal hold", type: "boolean" },
  { id: "reg_number", label: "Рег. номер", type: "string" },
];

export const EDMS_STATUS_VALUES = [
  "draft",
  "in_review",
  "approved",
  "signed",
  "rejected",
  "archived",
  "returned_for_revision",
] as const;
