import type { TFunction } from "@/i18n";
import type { FlowNode, FlowEdge } from "../types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

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
    const hasIncoming = edges.some((e) => e.target === node.id);
    const hasOutgoing = edges.some((e) => e.source === node.id);

    if (node.data.type !== "START" && !hasIncoming) {
      errors.push(`Узел "${node.data.label}" не имеет входящих связей`);
    }
    if (node.data.type !== "END" && !hasOutgoing) {
      errors.push(`Узел "${node.data.label}" не имеет исходящих связей`);
    }

    if (node.data.type === "FORK") {
      const out = edges.filter((e) => e.source === node.id);
      if (out.length < 2) {
        errors.push(`Узел разветвления "${node.data.label}" должен иметь минимум 2 исходящие ветки`);
      }
    }
    if (node.data.type === "JOIN") {
      const inc = edges.filter((e) => e.target === node.id);
      if (inc.length < 2) {
        errors.push(`Узел слияния "${node.data.label}" должен иметь минимум 2 входящие ветки`);
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

      const outgoingEdges = edges.filter((e) => e.source === nodeId);
      for (const edge of outgoingEdges) {
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
    const unreachable = nodes.filter((n) => !reachable.has(n.id));
    if (unreachable.length > 0) {
      errors.push(t("validation.workflow.unreachable"));
    }
  }

  return { isValid: errors.length === 0, errors };
};
