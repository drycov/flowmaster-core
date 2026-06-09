import type { TFunction } from "@/i18n";
import { interpolate } from "@/i18n/helpers";
import type { FlowNode, FlowEdge, AssigneeType } from "../types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

const ACTIONABLE_TYPES = new Set(["APPROVAL", "SIGNATURE", "TASK"]);
const REF_REQUIRED_MODES = new Set<AssigneeType>([
  "user",
  "position",
  "department",
  "department_head",
  "parent_department_head",
  "role",
  "group",
]);

export const validateWorkflow = (
  nodes: FlowNode[],
  edges: FlowEdge[],
  t: TFunction,
): ValidationResult => {
  const errors: string[] = [];

  const hasStart = nodes.some((n) => n.data.type === "START");
  const hasEnd = nodes.some((n) => n.data.type === "END");

  if (!hasStart) errors.push(t("validation.workflow.noStart"));
  if (!hasEnd) errors.push(t("validation.workflow.noEnd"));

  nodes.forEach((node) => {
    const label = node.data.label || node.id;
    const hasIncoming = edges.some((e) => e.target === node.id);
    const hasOutgoing = edges.some((e) => e.source === node.id);

    if (node.data.type !== "START" && !hasIncoming) {
      errors.push(interpolate(t("validation.workflow.noIncoming"), { label }));
    }
    if (!["END", "ARCHIVE"].includes(node.data.type) && !hasOutgoing) {
      errors.push(interpolate(t("validation.workflow.noOutgoing"), { label }));
    }

    if (ACTIONABLE_TYPES.has(node.data.type)) {
      const mode = (node.data.assignee_type || "user") as AssigneeType;
      if (REF_REQUIRED_MODES.has(mode) && !node.data.assignee_id) {
        errors.push(interpolate(t("validation.workflow.noAssignee"), { label }));
      }
    }

    if (node.data.type === "FORK") {
      const out = edges.filter((e) => e.source === node.id);
      if (out.length < 2) {
        errors.push(interpolate(t("validation.workflow.forkMinBranches"), { label }));
      }
    }

    if (node.data.type === "JOIN") {
      const inc = edges.filter((e) => e.target === node.id);
      if (inc.length < 2) {
        errors.push(interpolate(t("validation.workflow.joinMinBranches"), { label }));
      }
    }

    if (node.data.type === "CONDITION") {
      const out = edges.filter((e) => e.source === node.id);
      if (out.length < 2) {
        errors.push(interpolate(t("validation.workflow.conditionMinBranches"), { label }));
      }
      const withCondition = out.filter((e) => e.data?.condition?.trim());
      const withDefault = out.filter((e) => !e.data?.condition?.trim());
      if (withCondition.length === 0) {
        errors.push(interpolate(t("validation.workflow.conditionNeedsRules"), { label }));
      }
      if (withDefault.length === 0) {
        errors.push(interpolate(t("validation.workflow.conditionNeedsDefault"), { label }));
      }
    }
  });

  const hasCycle = (): boolean => {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      recursionStack.add(nodeId);
      for (const edge of edges.filter((e) => e.source === nodeId)) {
        if (dfs(edge.target)) return true;
      }
      recursionStack.delete(nodeId);
      return false;
    };

    const startNode = nodes.find((n) => n.data.type === "START");
    return startNode ? dfs(startNode.id) : false;
  };

  if (hasCycle()) {
    errors.push(t("validation.workflow.cycle"));
  }

  if (hasStart) {
    const reachable = new Set<string>();
    const startNode = nodes.find((n) => n.data.type === "START");
    if (startNode) {
      const queue = [startNode.id];
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (reachable.has(id)) continue;
        reachable.add(id);
        edges.filter((e) => e.source === id).forEach((e) => queue.push(e.target));
      }
    }
    if (nodes.some((n) => !reachable.has(n.id))) {
      errors.push(t("validation.workflow.unreachable"));
    }
  }

  return { isValid: errors.length === 0, errors };
};
