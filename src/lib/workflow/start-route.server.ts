import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { WorkflowDefinition } from "@/components/workflow-designer/types";
import type { customRouteStepSchema, graphDefinitionSchema } from "@/lib/workflow/custom-route-schema";
import { parseStoredCustomRoute } from "@/lib/workflow/route-builder";

type CustomRouteStep = z.infer<typeof customRouteStepSchema>;
type GraphRouteInput = z.infer<typeof graphDefinitionSchema>;

export type StartWorkflowRouteInput = {
  workflow_id?: string | null;
  custom_route?: unknown;
  graph_definition?: GraphRouteInput | null;
};

export type ResolvedStartWorkflowRoute = {
  workflowId: string | null;
  graphDef: WorkflowDefinition | null;
  customSteps: CustomRouteStep[] | null;
};

export function hasStoredWorkflowRoute(
  workflowId: string | null | undefined,
  customRoute: unknown,
): boolean {
  if (workflowId) return true;
  const parsed = parseStoredCustomRoute(customRoute);
  return Boolean(parsed.graph?.nodes?.length || parsed.steps?.length);
}

function graphFromInput(
  graphDefinition: GraphRouteInput | null | undefined,
  customRoute: unknown,
): WorkflowDefinition | null {
  if (graphDefinition?.nodes?.length) {
    return {
      nodes: graphDefinition.nodes as unknown as WorkflowDefinition["nodes"],
      edges: graphDefinition.edges ?? [],
    };
  }
  if (Array.isArray(customRoute)) return null;
  if (
    customRoute &&
    typeof customRoute === "object" &&
    Array.isArray((customRoute as { nodes?: unknown }).nodes)
  ) {
    const g = customRoute as WorkflowDefinition;
    if (!g.nodes?.length) return null;
    return { nodes: g.nodes, edges: g.edges ?? [] };
  }
  return null;
}

function stepsFromInput(customRoute: unknown): CustomRouteStep[] | null {
  return Array.isArray(customRoute) && customRoute.length > 0
    ? (customRoute as CustomRouteStep[])
    : null;
}

/** Resolve workflow route from request payload + documents_full (+ template default). */
export async function resolveStartWorkflowRoute(
  supabase: SupabaseClient,
  documentId: string,
  input: StartWorkflowRouteInput,
): Promise<ResolvedStartWorkflowRoute> {
  const { data: doc, error } = await supabase
    .from("documents_full" as never)
    .select("workflow_id, custom_route, template_id")
    .eq("id" as never, documentId)
    .single();

  if (error) throw new Error(error.message);

  const row = doc as {
    workflow_id?: string | null;
    custom_route?: unknown;
    template_id?: string | null;
  };

  let workflowId = input.workflow_id ?? row.workflow_id ?? null;
  let graphDef = graphFromInput(input.graph_definition, input.custom_route);
  let customSteps = stepsFromInput(input.custom_route);

  if (!graphDef && !customSteps && row.custom_route) {
    const stored = parseStoredCustomRoute(row.custom_route);
    graphDef = stored.graph;
    customSteps = stored.steps as CustomRouteStep[] | null;
  }

  if (!workflowId && !graphDef && !customSteps && row.template_id) {
    const { data: tpl } = await supabase
      .from("document_templates")
      .select("default_workflow_id")
      .eq("id", row.template_id)
      .maybeSingle();
    workflowId = (tpl as { default_workflow_id?: string | null } | null)?.default_workflow_id ?? null;
  }

  return { workflowId, graphDef, customSteps };
}
