import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DataTableShell, TableStatusRow } from "@/components/PageLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n, localized, workflowNodeLabel } from "@/i18n";
import { fmtRel } from "@/lib/format";
import { Check, ExternalLink, LockKeyhole, X } from "lucide-react";

type TaskRow = {
  id: string;
  title: string;
  node_type: string;
  action_required?: string;
  status: string;
  due_at?: string | null;
  document_id?: string;
  documents?: {
    id: string;
    reg_number: string;
    title_ru: string;
    title_kk: string;
    status: string;
  } | null;
};

type TaskDecision = "approve" | "reject";

type TasksTableProps = {
  tasks: TaskRow[];
  isLoading?: boolean;
  onDecision?: (taskId: string, decision: TaskDecision) => void;
  isPending?: boolean;
};

function isSignTask(task: TaskRow): boolean {
  return (
    task.action_required?.toLowerCase() === "sign" ||
    task.node_type?.toUpperCase() === "SIGNATURE"
  );
}

function isReviewTask(task: TaskRow): boolean {
  return task.action_required?.toLowerCase() === "review";
}

export function TasksTable({ tasks, isLoading, onDecision, isPending }: TasksTableProps) {
  const { t, locale } = useI18n();

  return (
    <DataTableShell>
      <table className="w-full data-table">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2 text-left">{t("common.title")}</th>
            <th className="w-32 px-4 py-2 text-left">{t("common.type")}</th>
            <th className="w-32 px-4 py-2 text-left">{t("common.deadline")}</th>
            <th className="w-28 px-4 py-2 text-left">{t("common.status")}</th>
            <th className="w-52 px-4 py-2 text-right">{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <TableStatusRow colSpan={5}>{t("common.loading")}</TableStatusRow>}
          {!isLoading && tasks.length === 0 && (
            <TableStatusRow colSpan={5}>{t("common.empty")}</TableStatusRow>
          )}
          {!isLoading &&
            tasks.map((task) => {
              const doc = task.documents;
              const docId = doc?.id ?? task.document_id;
              const signTask = isSignTask(task);
              const reviewTask = isReviewTask(task);
              const canQuickDecide = !signTask && !reviewTask && !!onDecision;

              return (
                <tr key={task.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-2">
                    {docId ? (
                      <Link
                        to="/documents/$id"
                        params={{ id: docId }}
                        className="text-primary hover:underline"
                      >
                        {doc ? localized(doc, locale, "title") : task.title}
                      </Link>
                    ) : (
                      task.title
                    )}
                    <div className="font-mono text-xs text-muted-foreground">
                      {doc?.reg_number ?? ""}
                    </div>
                    {task.title && doc && (
                      <div className="text-xs text-muted-foreground">{task.title}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs uppercase tracking-wider">
                    {workflowNodeLabel(t, task.node_type)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {task.due_at ? fmtRel(task.due_at, locale) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={task.status} kind="status" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex gap-1">
                      {docId && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/documents/$id" params={{ id: docId }}>
                            {signTask ? (
                              <>
                                <LockKeyhole className="mr-1 h-3 w-3" />
                                {t("task.action.sign")}
                              </>
                            ) : (
                              <>
                                <ExternalLink className="mr-1 h-3 w-3" />
                                {t("task.action.open")}
                              </>
                            )}
                          </Link>
                        </Button>
                      )}
                      {canQuickDecide && (
                        <>
                          <Button
                            size="sm"
                            disabled={isPending}
                            onClick={() => onDecision!(task.id, "approve")}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            {t("common.approve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isPending}
                            onClick={() => onDecision!(task.id, "reject")}
                          >
                            <X className="mr-1 h-3 w-3" />
                            {t("common.reject")}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </DataTableShell>
  );
}
