import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import type { WorkflowDefinition } from "@/components/workflow-designer/types";
import {
  findStartNodeId,
  normalizeWorkflowDefinition,
} from "@/lib/workflow/route-builder";

async function advanceFromStart(
  runId: string,
  docId: string,
  def: WorkflowDefinition,
  supabase: SupabaseClient,
) {
  const normalized = normalizeWorkflowDefinition(def);
  const start = normalized.nodes.find((n) => n.type === "START");
  if (!start) throw new Error("No START node");
  const { error } = await supabase.rpc("wf_advance_from_node", {
    _run_id: runId,
    _doc_id: docId,
    _from_node_id: start.id,
    _nodes: normalized.nodes as unknown as Json,
    _edges: normalized.edges as unknown as Json,
  });
  if (error) {
    if (error.message.includes("has no assignees")) {
      throw new Error(
        "У этапа маршрута не назначен исполнитель. Назначьте руководителя сотруднику или роль кадровой службы (hr_officer).",
      );
    }
    throw new Error(error.message);
  }
}

/** Start workflow run for a document (service-role or authenticated client with insert rights). */
export async function startWorkflowForDocument(
  supabase: SupabaseClient,
  opts: {
    documentId: string;
    workflowId: string;
    actorId: string;
    definition?: WorkflowDefinition;
  },
): Promise<string> {
  const { documentId, workflowId, actorId } = opts;

  const { data: activeRun } = await supabase
    .from("workflow_runs")
    .select("id")
    .eq("document_id", documentId)
    .eq("status", "running")
    .maybeSingle();
  if (activeRun) throw new Error("Маршрут уже запущен для этого документа");

  let def = opts.definition;
  if (!def) {
    const { data: wf, error: wfErr } = await supabase
      .from("workflows")
      .select("definition")
      .eq("id", workflowId)
      .single();
    if (wfErr) throw new Error(wfErr.message);
    def = wf.definition as unknown as WorkflowDefinition;
  }

  const normalized = normalizeWorkflowDefinition(def);
  const startId = findStartNodeId(normalized);

  const { data: run, error } = await supabase
    .from("workflow_runs")
    .insert({
      workflow_id: workflowId,
      document_id: documentId,
      current_node: startId,
      status: "running",
      context: normalized as unknown as Json,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("workflow_events").insert({
    run_id: run.id,
    document_id: documentId,
    event_type: "workflow.started",
    node_id: startId,
    actor_id: actorId,
    payload: { source: "hr_leave_package" },
  } as never);

  await supabase
    .from("documents")
    .update({ status: "in_review" as never })
    .eq("id", documentId);

  await advanceFromStart(run.id as string, documentId, normalized, supabase);
  return run.id as string;
}
