import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMyTasks } from "@/lib/api/workflows.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { t } = useI18n();
  const { data } = useQuery({ queryKey: ["myTasks"], queryFn: () => listMyTasks() });
  const approvals = (data ?? []).filter((t) => t.node_type === "APPROVAL");

  return (
    <>
      <PageHeader title={t("nav.approvals")} description={`${approvals.length} активных`} />
      <PageBody>
        <div className="text-sm text-muted-foreground">
          Перейдите в раздел "{t("nav.tasks")}" для действий с задачами. Здесь показаны только согласования: {approvals.length}.
        </div>
      </PageBody>
    </>
  );
}
