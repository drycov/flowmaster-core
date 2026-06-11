import { describe, expect, it } from "vitest";
import { hasStoredWorkflowRoute } from "./start-route.server";

describe("hasStoredWorkflowRoute", () => {
  it("returns true when workflow_id is set", () => {
    expect(hasStoredWorkflowRoute("uuid", null)).toBe(true);
  });

  it("returns true for custom linear route", () => {
    expect(
      hasStoredWorkflowRoute(null, [{ order: 0, assignee_mode: "user", sla_hours: 24, action: "approve" }]),
    ).toBe(true);
  });

  it("returns true for graph custom_route", () => {
    expect(
      hasStoredWorkflowRoute(null, {
        nodes: [{ id: "start", type: "START" }],
        edges: [],
      }),
    ).toBe(true);
  });

  it("returns false when route is empty", () => {
    expect(hasStoredWorkflowRoute(null, null)).toBe(false);
    expect(hasStoredWorkflowRoute(null, [])).toBe(false);
  });
});
