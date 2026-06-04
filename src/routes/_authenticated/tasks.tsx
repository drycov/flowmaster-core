import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyTasks, completeTask } from "@/lib/api/workflows.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { useI18n, localized } from "@/lib/i18n";
import { fmtRel } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["myTasks"], queryFn: () => listMyTasks() });

  const act = useMutation({
    mutationFn: (vars: { task_id: string; decision: "approve" | "reject" }) =>
      completeTask({ data: vars }),
    onSuccess: (_d, v) => {
      toast.success(v.decision === "approve" ? "Согласовано" : "Отклонено");
      qc.invalidateQueries({ queryKey: ["myTasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <>
      <PageHeader title={t("nav.tasks")} />
      <PageBody>
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <table className="w-full data-table">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2">{t("common.title")}</th>
              <th className="text-left px-4 py-2 w-32">{t("common.type")}</th>
              <th className="text-left px-4 py-2 w-32">{t("common.deadline")}</th>
              <th className="text-left px-4 py-2 w-28">{t("common.status")}</th>
              <th className="text-right px-4 py-2 w-44">{t("common.actions")}</th>
            </tr></thead>
            <tbody>
              {(data ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("common.empty")}</td></tr>
              ) : data!.map((task) => {
                const doc = (task as { documents: { id: string; reg_number: string; title_ru: string; title_kk: string; status: string } | null }).documents;
                return (
                  <tr key={task.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-2">
                      {doc ? (
                        <Link to="/documents/$id" params={{ id: doc.id }} className="text-primary hover:underline">
                          {localized(doc, locale, "title")}
                        </Link>
                      ) : task.title}
                      <div className="text-xs text-muted-foreground font-mono">{doc?.reg_number ?? ""}</div>
                    </td>
                    <td className="px-4 py-2 text-xs uppercase tracking-wider">{task.node_type}</td>
                    <td className="px-4 py-2 text-xs">{task.due_at ? fmtRel(task.due_at, locale) : "—"}</td>
                    <td className="px-4 py-2"><StatusBadge status={task.status} /></td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" onClick={() => act.mutate({ task_id: task.id, decision: "approve" })}>
                          <Check className="w-3 h-3 mr-1" />{t("common.approve")}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => act.mutate({ task_id: task.id, decision: "reject" })}>
                          <X className="w-3 h-3 mr-1" />{t("common.reject")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}
