import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMySubstitutions } from "@/lib/api/substitutions.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { TasksTable } from "@/components/tasks/TasksTable";
import { SubstitutionActingBanner } from "@/components/substitution/SubstitutionActingBanner";
import { useI18n } from "@/i18n";
import {
  useMyTasksQuery,
  useWorkflowTaskActions,
} from "@/components/tasks/useWorkflowTaskActions";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const { t } = useI18n();
  const { data, isLoading } = useMyTasksQuery();
  const { data: subs } = useQuery({
    queryKey: ["my-substitutions"],
    queryFn: listMySubstitutions,
  });
  const act = useWorkflowTaskActions();

  return (
    <>
      <PageHeader title={t("nav.tasks")} />
      <PageBody>
        <div className="space-y-4">
          <SubstitutionActingBanner actingFor={subs?.actingForDetails ?? []} />
          <TasksTable
            tasks={(data ?? []) as never}
            isLoading={isLoading}
            isPending={act.isPending}
            onDecision={(taskId, decision) => act.mutate({ task_id: taskId, decision })}
          />
        </div>
      </PageBody>
    </>
  );
}
