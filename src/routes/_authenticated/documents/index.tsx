import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDocuments, type DocumentListRowEnriched } from "@/lib/api/documents.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { DataTableShell, PageToolbar, SearchField, TableStatusRow } from "@/components/PageLayout";
import { StatusBadge, SlaBadge } from "@/components/StatusBadge";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState, useDeferredValue } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Archive } from "lucide-react";
import { bulkUpdateDocuments } from "@/lib/api/bulk.functions";
import { listUsersBrief } from "@/lib/api/admin.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, FilePen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents/")({
  component: DocumentsList,
});

function DocumentsList() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  // Отложенное значение для поиска (Debounce "из коробки" React)
  const deferredSearch = useDeferredValue(search);

  const [status, setStatus] = useState<string>("all");
  const [scope, setScope] = useState<"all" | "mine" | "assigned">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkStatus, setBulkStatus] = useState<"draft" | "cancelled" | "archived">("draft");
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["users-brief"],
    queryFn: listUsersBrief,
    enabled: selected.size > 0,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["documents", { search: deferredSearch, status, scope }],
    queryFn: () =>
      listDocuments({
        data: {
          search: deferredSearch || undefined, // Убираем пустые строки из пейлоада
          status: status === "all" ? undefined : status,
          scope: scope === "all" ? undefined : scope, // Приводим к единому стилю API
        },
      }),
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: {
      ids: string[];
      action: "archive" | "assign" | "status";
      assignee_id?: string;
      status?: "draft" | "cancelled" | "archived";
    }) =>
      bulkUpdateDocuments({
        data: {
          document_ids: payload.ids,
          action: payload.action,
          assignee_id: payload.assignee_id,
          status: payload.status,
        },
      }),
    onSuccess: (res, vars) => {
      const label =
        vars.action === "archive"
          ? t("bulk.archived")
          : vars.action === "assign"
            ? t("bulk.assigned")
            : t("bulk.statusChanged");
      toast.success(`${label}: ${res.success}/${res.processed}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("bulk.error")),
  });

  const rows: DocumentListRowEnriched[] = data ?? [];
  const allSelected = rows.length > 0 && rows.every((d) => selected.has(d.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((d) => d.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <PageHeader
        title={t("nav.documents")}
        actions={
          <Button
            onClick={() =>
              navigate({
                to: "/documents/new",
                search: {
                  projectId: undefined,
                  templateId: undefined,
                  nomenclatureId: undefined,
                  departmentId: undefined,
                  documentTypeCode: undefined,
                },
              })
            }
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            {t("doc.new")}
          </Button>
        }
      />
      <PageBody>
        <PageToolbar>
          <SearchField value={search} onChange={setSearch} placeholder={t("common.search")} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder={t("common.all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="draft">{t("status.draft")}</SelectItem>
              <SelectItem value="in_review">{t("status.in_review")}</SelectItem>
              <SelectItem value="approved">{t("status.approved")}</SelectItem>
              <SelectItem value="signed">{t("status.signed")}</SelectItem>
              <SelectItem value="rejected">{t("status.rejected")}</SelectItem>
              <SelectItem value="archived">{t("status.archived")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder={t("common.all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="mine">{t("scope.mine")}</SelectItem>
              <SelectItem value="assigned">{t("scope.assigned")}</SelectItem>
            </SelectContent>
          </Select>
        </PageToolbar>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3 p-2 border rounded-sm bg-muted/30">
            <span className="text-sm text-muted-foreground">
              {t("bulk.selected")}: {selected.size}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ ids: [...selected], action: "archive" })}
            >
              <Archive className="w-3 h-3 mr-1" />
              {t("bulk.archive")}
            </Button>
            <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
              <SelectTrigger className="w-48 h-8">
                <SelectValue placeholder={t("bulk.assignee")} />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {localized(u, locale, "full_name")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkMutation.isPending || !bulkAssignee}
              onClick={() =>
                bulkMutation.mutate({
                  ids: [...selected],
                  action: "assign",
                  assignee_id: bulkAssignee,
                })
              }
            >
              <UserPlus className="w-3 h-3 mr-1" />
              {t("bulk.assign")}
            </Button>
            <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as typeof bulkStatus)}>
              <SelectTrigger className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("status.draft")}</SelectItem>
                <SelectItem value="cancelled">{t("status.cancelled")}</SelectItem>
                <SelectItem value="archived">{t("status.archived")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkMutation.isPending}
              onClick={() =>
                bulkMutation.mutate({
                  ids: [...selected],
                  action: "status",
                  status: bulkStatus,
                })
              }
            >
              <FilePen className="w-3 h-3 mr-1" />
              {t("bulk.setStatus")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {t("common.cancel")}
            </Button>
          </div>
        )}

        <DataTableShell className="hidden md:block">
          <table className="w-full data-table">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-2 py-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="select all"
                  />
                </th>
                <th className="text-left px-4 py-2 w-64">{t("doc.regNumber")}</th>
                <th className="text-left px-4 py-2">{t("common.title")}</th>
                <th className="text-left px-4 py-2 w-48">{t("common.status")}</th>
                <th className="text-left px-4 py-2 w-28">SLA</th>
                <th className="text-left px-4 py-2 w-32">{t("common.date")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableStatusRow colSpan={6}>{t("common.loading")}</TableStatusRow>}
              {!isLoading && rows.length === 0 && (
                <TableStatusRow colSpan={6}>{t("common.empty")}</TableStatusRow>
              )}
              {rows.map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-2 py-2">
                    <Checkbox
                      checked={selected.has(d.id)}
                      onCheckedChange={() => toggleOne(d.id)}
                    />
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{d.reg_number}</td>
                  <td className="px-4 py-2">
                    <Link
                      to="/documents/$id"
                      params={{ id: d.id }}
                      className="text-primary hover:underline"
                    >
                      {localized(d, locale, "title")}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-2">
                    <SlaBadge sla={d.sla_status ?? "ok"} />
                  </td>
                  <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                    {fmtDateShort(d.created_at, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>

        <div className="md:hidden space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground p-3">{t("common.loading")}</p>}
          {!isLoading &&
            rows.map((d) => (
              <div key={d.id} className="border rounded-sm p-3 flex gap-3 bg-card">
                <Checkbox
                  checked={selected.has(d.id)}
                  onCheckedChange={() => toggleOne(d.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs text-muted-foreground">{d.reg_number}</div>
                  <Link
                    to="/documents/$id"
                    params={{ id: d.id }}
                    className="font-medium text-sm text-primary block truncate"
                  >
                    {localized(d, locale, "title")}
                  </Link>
                  <div className="flex gap-2 mt-2">
                    <StatusBadge status={d.status} />
                    <SlaBadge sla={d.sla_status ?? "ok"} />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </PageBody>
    </>
  );
}
