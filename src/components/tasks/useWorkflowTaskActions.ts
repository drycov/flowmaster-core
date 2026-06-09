import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { advanceWorkflowTask, listMyTasks } from "@/lib/api/workflows.functions";

export type WorkflowDecision = "approve" | "reject" | "return";

type AdvanceTaskVars = {
  task_id: string;
  decision: WorkflowDecision;
  comment?: string | null;
};

export function useMyTasksQuery() {
  return useQuery({ queryKey: ["myTasks"], queryFn: () => listMyTasks() });
}

export function useWorkflowTaskActions(options?: {
  documentId?: string;
  defaultRejectComment?: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const defaultRejectComment = options?.defaultRejectComment ?? t("task.rejectDefaultComment");

  return useMutation({
    mutationFn: (vars: AdvanceTaskVars) =>
      advanceWorkflowTask({
        data: {
          task_id: vars.task_id,
          decision: vars.decision,
          comment:
            vars.comment !== undefined
              ? vars.comment
              : vars.decision === "reject"
                ? defaultRejectComment
                : null,
        },
      }),
    onSuccess: (_d, v) => {
      const messages: Record<WorkflowDecision, string> = {
        approve: t("doc.action.approved"),
        reject: t("doc.action.rejected"),
        return: t("doc.action.returned"),
      };
      toast.success(messages[v.decision]);
      qc.invalidateQueries({ queryKey: ["myTasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (options?.documentId) {
        qc.invalidateQueries({ queryKey: ["document", options.documentId] });
      } else {
        qc.invalidateQueries({ queryKey: ["document"] });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
}

export function filterApprovalTasks<T extends { node_type?: string; action_required?: string }>(
  tasks: T[],
): T[] {
  return tasks.filter(
    (task) =>
      task.node_type === "APPROVAL" ||
      (task.action_required?.toLowerCase() === "approve" && task.node_type !== "SIGNATURE"),
  );
}
