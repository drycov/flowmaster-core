import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_TYPE_ICONS, NODE_TYPE_LABEL_KEYS, NODE_STYLE_BY_TYPE } from "../constants";
import { useI18n } from "@/i18n";
import type { WorkflowNodeData, NodeType } from "../types";

function WorkflowCanvasNodeComponent({ data, selected }: NodeProps) {
  const { t } = useI18n();
  const nodeData = data as WorkflowNodeData;
  const type = nodeData.type as NodeType;
  const icon = NODE_TYPE_ICONS[type] ?? "•";
  const typeLabel = t(NODE_TYPE_LABEL_KEYS[type]);
  const sla =
    nodeData.sla_hours != null && nodeData.sla_hours > 0
      ? `${nodeData.sla_hours} ${nodeData.sla_unit === "business_days" ? t("wf.sla.workdays") : t("wf.sla.hours")}`
      : null;

  const typeStyle = NODE_STYLE_BY_TYPE[type] ?? {};

  return (
    <div
      className={`rounded-lg border-2 px-3 py-2 min-w-[140px] text-center shadow-sm transition-shadow ${
        selected ? "ring-2 ring-primary ring-offset-1" : ""
      }`}
      style={typeStyle}
    >
      {type !== "START" && (
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400" />
      )}
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
        <span>{icon}</span>
        <span>{typeLabel}</span>
      </div>
      <div className="text-xs font-semibold mt-0.5 leading-tight">
        {nodeData.label || typeLabel}
      </div>
      {nodeData.assignee_type && ["APPROVAL", "SIGNATURE", "TASK"].includes(type) && (
        <div className="text-[10px] text-muted-foreground mt-1 truncate">
          {t(
            (
              {
                user: "wf.assignee.user",
                position: "wf.assignee.position",
                department: "wf.assignee.department",
                department_head: "wf.assignee.deptHead",
                parent_department_head: "wf.assignee.parentDeptHead",
                initiator_manager: "wf.assignee.initiatorManager",
                role: "wf.assignee.role",
                group: "wf.assignee.group",
              } as const
            )[nodeData.assignee_type] ?? "wf.assignee.user",
          )}
        </div>
      )}
      {sla && (
        <div className="text-[10px] mt-1 inline-block rounded bg-amber-50 text-amber-800 px-1.5 py-0.5 border border-amber-200">
          SLA {sla}
        </div>
      )}
      {type !== "END" && type !== "ARCHIVE" && (
        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-400" />
      )}
    </div>
  );
}

export const WorkflowCanvasNode = memo(WorkflowCanvasNodeComponent);
