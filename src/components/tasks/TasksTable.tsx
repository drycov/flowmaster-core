import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DataTableShell, TableStatusRow } from "@/components/PageLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n, localized } from "@/i18n";
import { fmtRel } from "@/lib/format";
import { Check, X } from "lucide-react";

type TaskRow = {
  id: string;
  title: string;
  node_type: string;
  status: string;
  due_at?: string | null;
  documents?: {
    id: string;
    reg_number: string;
    title_ru: string;
    title_kk: string;
    status: string;
  } | null;
};

type TasksTableProps = {
  tasks: TaskRow[];
  isLoading?: boolean;
  onDecision: (taskId: string, decision: "approve" | "reject") => void;
  isPending?: boolean;
};

export function TasksTable({ tasks, isLoading, onDecision, isPending }: TasksTableProps) {
  const { t, locale } = useI18n();

  return (
    <DataTableShell>
      <table className="w-full data-table">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="text-left px-4 py-2">{t("common.title")}</th>
            <th className="text-left px-4 py-2 w-32">{t("common.type")}</th>
            <th className="text-left px-4 py-2 w-32">{t("common.deadline")}</th>
            <th className="text-left px-4 py-2 w-28">{t("common.status")}</th>
            <th className="text-right px-4 py-2 w-44">{t("common.actions")}</th>
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
              return (
                <tr key={task.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-2">
                    {doc ? (
                      <Link
                        to="/documents/$id"
                        params={{ id: doc.id }}
                        className="text-primary hover:underline"
                      >
                        {localized(doc, locale, "title")}
                      </Link>
                    ) : (
                      task.title
                    )}
                    <div className="text-xs text-muted-foreground font-mono">
                      {doc?.reg_number ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs uppercase tracking-wider">{task.node_type}</td>
                  <td className="px-4 py-2 text-xs">
                    {task.due_at ? fmtRel(task.due_at, locale) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => onDecision(task.id, "approve")}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        {t("common.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => onDecision(task.id, "reject")}
                      >
                        <X className="w-3 h-3 mr-1" />
                        {t("common.reject")}
                      </Button>
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
