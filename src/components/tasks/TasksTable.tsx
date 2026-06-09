import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DataTableShell, TableStatusRow } from "@/components/PageLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n, localized, workflowNodeLabel, interpolate } from "@/i18n";
import { fmtRel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink, LockKeyhole, UserRoundCog, X } from "lucide-react";

type TaskRow = {
  id: string;
  title: string;
  node_type: string;
  action_required?: string;
  status: string;
  due_at?: string | null;
  document_id?: string;
  is_substitute?: boolean;
  substitute_principal?: {
    id: string;
    full_name_ru?: string;
    full_name_kk?: string;
    email?: string;
  } | null;
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
    task.action_required?.toLowerCase() === "sign" || task.node_type?.toUpperCase() === "SIGNATURE"
  );
}

function isReviewTask(task: TaskRow): boolean {
  return task.action_required?.toLowerCase() === "review";
}

export function TasksTable({ tasks, isLoading, onDecision, isPending }: TasksTableProps) {
  const { t, locale } = useI18n();

  const renderTaskActions = (
    task: TaskRow,
    docId: string | undefined,
    signTask: boolean,
    canQuickDecide: boolean,
  ) => (
    <div className="flex flex-wrap gap-1 justify-end">
      {docId && (
        <Button size="sm" variant="outline" asChild className="flex-1 sm:flex-none">
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
      {canQuickDecide && onDecision && (
        <>
          <Button
            size="sm"
            className="flex-1 sm:flex-none"
            disabled={isPending}
            onClick={() => onDecision(task.id, "approve")}
          >
            <Check className="mr-1 h-3 w-3" />
            {t("common.approve")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1 sm:flex-none"
            disabled={isPending}
            onClick={() => onDecision(task.id, "reject")}
          >
            <X className="mr-1 h-3 w-3" />
            {t("common.reject")}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <DataTableShell>
      <div className="md:hidden space-y-3 p-3">
        {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
        {!isLoading && tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
        )}
        {!isLoading &&
          tasks.map((task) => {
            const doc = task.documents;
            const docId = doc?.id ?? task.document_id;
            const signTask = isSignTask(task);
            const reviewTask = isReviewTask(task);
            const canQuickDecide = !signTask && !reviewTask && !!onDecision;

            return (
              <div key={task.id} className="border rounded-sm p-3 space-y-2 bg-card">
                <div>
                  {docId ? (
                    <Link
                      to="/documents/$id"
                      params={{ id: docId }}
                      className="font-medium text-sm text-primary"
                    >
                      {doc ? localized(doc, locale, "title") : task.title}
                    </Link>
                  ) : (
                    <div className="font-medium text-sm">{task.title}</div>
                  )}
                  <div className="font-mono text-xs text-muted-foreground">{doc?.reg_number}</div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs items-center">
                  <StatusBadge status={task.status} kind="status" />
                  {task.is_substitute && task.substitute_principal ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-1 border-amber-400 text-amber-800 dark:text-amber-300"
                    >
                      <UserRoundCog className="w-3 h-3" />
                      {interpolate(t("substitution.forUser"), {
                        name:
                          localized(task.substitute_principal, locale, "full_name") ||
                          task.substitute_principal.id,
                      })}
                    </Badge>
                  ) : null}
                  <span className="text-muted-foreground uppercase">
                    {workflowNodeLabel(t, task.node_type)}
                  </span>
                  {task.due_at ? (
                    <span className="text-muted-foreground">{fmtRel(task.due_at, locale)}</span>
                  ) : null}
                </div>
                {renderTaskActions(task, docId, signTask, canQuickDecide)}
              </div>
            );
          })}
      </div>

      <table className="w-full data-table hidden md:table">
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
                    {task.is_substitute && task.substitute_principal ? (
                      <Badge
                        variant="outline"
                        className="mt-1 text-[10px] gap-1 border-amber-400 text-amber-800 dark:text-amber-300"
                      >
                        <UserRoundCog className="w-3 h-3" />
                        {interpolate(t("substitution.forUser"), {
                          name:
                            localized(task.substitute_principal, locale, "full_name") ||
                            task.substitute_principal.id,
                        })}
                      </Badge>
                    ) : null}
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
                    {renderTaskActions(task, docId, signTask, canQuickDecide)}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </DataTableShell>
  );
}
