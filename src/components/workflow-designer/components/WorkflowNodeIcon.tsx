import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Archive,
  Bell,
  CheckCircle2,
  ClipboardList,
  Flag,
  GitBranch,
  Merge,
  PenLine,
  Play,
  Split,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeType } from "../types";

export const NODE_TYPE_ICON_COMPONENTS: Record<NodeType, LucideIcon> = {
  START: Play,
  APPROVAL: CheckCircle2,
  SIGNATURE: PenLine,
  TASK: ClipboardList,
  CONDITION: GitBranch,
  FORK: Split,
  JOIN: Merge,
  NOTIFICATION: Bell,
  TIMER: Timer,
  ESCALATION: AlertTriangle,
  ARCHIVE: Archive,
  END: Flag,
};

interface WorkflowNodeIconProps {
  type: NodeType;
  className?: string;
}

export function WorkflowNodeIcon({ type, className }: WorkflowNodeIconProps) {
  const Icon = NODE_TYPE_ICON_COMPONENTS[type];
  if (!Icon) return null;
  return <Icon className={cn("shrink-0", className)} aria-hidden />;
}
