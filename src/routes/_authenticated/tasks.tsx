import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyTasks, advanceWorkflowTask } from "@/lib/api/workflows.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { TasksTable } from "@/components/tasks/TasksTable";
import { useI18n } from "@/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["myTasks"], queryFn: () => listMyTasks() });

  const act = useMutation({
    mutationFn: (vars: { task_id: string; decision: "approve" | "reject" }) =>
      advanceWorkflowTask({
        data: {
          task_id: vars.task_id,
          decision: vars.decision,
          comment: vars.decision === "reject" ? t("task.rejectDefaultComment") : null,
        },
      }),
    onSuccess: (_d, v) => {
      toast.success(v.decision === "approve" ? t("doc.action.approved") : t("doc.action.rejected"));
      qc.invalidateQueries({ queryKey: ["myTasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["document"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <>
      <PageHeader title={t("nav.tasks")} />
      <PageBody>
        <TasksTable
          tasks={(data ?? []) as never}
          isLoading={isLoading}
          isPending={act.isPending}
          onDecision={(taskId, decision) => act.mutate({ task_id: taskId, decision })}
        />
      </PageBody>
    </>
  );
}
