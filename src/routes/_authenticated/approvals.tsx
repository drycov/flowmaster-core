import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/AppShell";
import { TasksTable } from "@/components/tasks/TasksTable";
import { useI18n } from "@/i18n";
import {
  filterApprovalTasks,
  useMyTasksQuery,
  useWorkflowTaskActions,
} from "@/components/tasks/useWorkflowTaskActions";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { t } = useI18n();
  const { data, isLoading } = useMyTasksQuery();
  const approvals = filterApprovalTasks(data ?? []);
  const act = useWorkflowTaskActions();

  return (
    <>
      <PageHeader
        title={t("nav.approvals")}
        description={`${approvals.length} — ${t("approvals.description")}`}
      />
      <PageBody>
        <TasksTable
          tasks={approvals as never}
          isLoading={isLoading}
          isPending={act.isPending}
          onDecision={(taskId, decision) => act.mutate({ task_id: taskId, decision })}
        />
      </PageBody>
    </>
  );
}
