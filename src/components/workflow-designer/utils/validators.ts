import type { FlowNode, FlowEdge } from "../types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateWorkflow = (nodes: FlowNode[], edges: FlowEdge[]): ValidationResult => {
  const errors: string[] = [];

  const hasStart = nodes.some((n) => n.data.type === "START");
  const hasEnd = nodes.some((n) => n.data.type === "END");

  if (!hasStart) errors.push("Отсутствует стартовый узел (START)");
  if (!hasEnd) errors.push("Отсутствует конечный узел (END)");

  nodes.forEach((node) => {
    const hasIncoming = edges.some((e) => e.target === node.id);
    const hasOutgoing = edges.some((e) => e.source === node.id);

    if (node.data.type !== "START" && !hasIncoming) {
      errors.push(`Узел "${node.data.label}" не имеет входящих связей`);
    }
    if (node.data.type !== "END" && !hasOutgoing) {
      errors.push(`Узел "${node.data.label}" не имеет исходящих связей`);
    }
  });

  // Проверка на циклы
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
    errors.push("Обнаружен цикл в маршруте workflow. Убедитесь, что путь всегда достигает конечного узла.");
  }

  return { isValid: errors.length === 0, errors };
};