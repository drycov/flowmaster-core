import { describe, expect, it } from "vitest";
import { normalizeWorkflowDefinition } from "@/lib/workflow/route-builder";
import type { WorkflowDefinition } from "@/components/workflow-designer/types";

describe("normalizeWorkflowDefinition", () => {
  it("copies nested assignee fields to top level", () => {
    const def: WorkflowDefinition = {
      nodes: [
        { id: "start", type: "START", position: { x: 0, y: 0 } },
        {
          id: "node_sig",
          type: "SIGNATURE",
          label: "Подписание",
          position: { x: 0, y: 80 },
          data: {
            type: "SIGNATURE",
            assignee_type: "user",
            assignee_id: "11111111-1111-4111-8111-111111111111",
          },
        },
        { id: "end", type: "END", position: { x: 0, y: 160 } },
      ],
      edges: [],
    };

    const normalized = normalizeWorkflowDefinition(def);
    const sig = normalized.nodes.find((n) => n.id === "node_sig");

    expect(sig?.assignee_mode).toBe("user");
    expect(sig?.assignee_ref).toBe("11111111-1111-4111-8111-111111111111");
    expect(sig?.data?.assignee_mode).toBe("user");
    expect(sig?.data?.assignee_ref).toBe("11111111-1111-4111-8111-111111111111");
  });
});
