import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertCircle } from "lucide-react";
import { NODE_TYPE_ICONS, NODE_TYPE_LABEL_KEYS, NODE_STYLE_BY_TYPE } from "../constants";
import { useI18n } from "@/i18n";
import { useWorkflowDesignerLookup } from "../context/WorkflowDesignerContext";
import { resolveAssigneeLabel } from "@/lib/workflow/assignee-display";
import type { WorkflowNodeData, NodeType, AssigneeType } from "../types";

const REF_REQUIRED = new Set<AssigneeType>([
  "user",
  "position",
  "department",
  "department_head",
  "parent_department_head",
  "role",
  "group",
]);

function WorkflowCanvasNodeComponent({ data, selected }: NodeProps) {
  const { t, locale } = useI18n();
  const lookup = useWorkflowDesignerLookup();
  const nodeData = data as WorkflowNodeData;
  const type = nodeData.type as NodeType;
  const icon = NODE_TYPE_ICONS[type] ?? "•";
  const typeLabel = t(NODE_TYPE_LABEL_KEYS[type]);
  const sla =
    nodeData.sla_hours != null && nodeData.sla_hours > 0
      ? `${nodeData.sla_hours} ${nodeData.sla_unit === "business_days" ? t("wf.sla.workdays") : t("wf.sla.hours")}`
      : null;

  const assigneeType = (nodeData.assignee_type || "user") as AssigneeType;
  const missingAssignee =
    ["APPROVAL", "SIGNATURE", "TASK"].includes(type) &&
    REF_REQUIRED.has(assigneeType) &&
    !nodeData.assignee_id;

  const assigneeLabel =
    nodeData.assignee_type && ["APPROVAL", "SIGNATURE", "TASK"].includes(type)
      ? resolveAssigneeLabel({
          mode: assigneeType,
          ref: nodeData.assignee_id ?? null,
          locale,
          lookup,
          t,
        })
      : null;

  const typeStyle = NODE_STYLE_BY_TYPE[type] ?? {};

  return (
    <div
      className={`relative min-w-[160px] max-w-[220px] rounded-xl border-2 px-3 py-2.5 text-center shadow-sm transition-all ${
        selected ? "ring-2 ring-primary ring-offset-2 shadow-md" : "hover:shadow-md"
      } ${missingAssignee ? "border-amber-400" : ""}`}
      style={typeStyle}
    >
      {missingAssignee && (
        <span
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white"
          title={t("wf.properties.missingAssignee")}
        >
          <AlertCircle className="h-3 w-3" />
        </span>
      )}

      {type !== "START" && (
        <Handle type="target" position={Position.Top} className="!h-2.5 !w-2.5 !border-2 !bg-white" />
      )}

      <div className="flex items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-wide opacity-80">
        <span>{icon}</span>
        <span>{typeLabel}</span>
      </div>

      <div className="mt-1 text-sm font-semibold leading-snug">
        {nodeData.label || typeLabel}
      </div>

      {assigneeLabel && (
        <div className="mt-1.5 truncate rounded bg-black/5 px-1.5 py-0.5 text-[11px] font-medium">
          {assigneeLabel}
        </div>
      )}

      {sla && (
        <div className="mt-1.5 inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">
          SLA {sla}
        </div>
      )}

      {type !== "END" && type !== "ARCHIVE" && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2.5 !w-2.5 !border-2 !bg-white"
        />
      )}
    </div>
  );
}

export const WorkflowCanvasNode = memo(WorkflowCanvasNodeComponent);
