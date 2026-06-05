import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDocuments } from "@/lib/api/documents.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { StatusBadge, SlaBadge } from "@/components/StatusBadge";
import { useI18n, localized } from "@/lib/i18n";
import { fmtDateShort } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useState, useDeferredValue } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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
  
  const { data, isLoading } = useQuery({
    queryKey: ["documents", { search: deferredSearch, status, scope }],
    queryFn: () => listDocuments({ 
      data: { 
        search: deferredSearch || undefined, // Убираем пустые строки из пейлоада
        status: status === "all" ? undefined : status, 
        scope: scope === "all" ? undefined : scope // Приводим к единому стилю API
      } 
    }),
  });

  return (
    <>
      <PageHeader
        title={t("nav.documents")}
        actions={
          <Button onClick={() => navigate({ to: "/documents/new" })} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            {t("doc.new")}
          </Button>
        }
      />
      <PageBody>
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              className="pl-8 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
              <SelectItem value="mine">{t("scope.mine") || "Мои"}</SelectItem>
              <SelectItem value="assigned">{t("scope.assigned") || "Назначенные"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <table className="w-full data-table">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2 w-64">{t("doc.regNumber")}</th>
                <th className="text-left px-4 py-2">{t("common.title")}</th>
                <th className="text-left px-4 py-2 w-48">{t("common.status")}</th>
                <th className="text-left px-4 py-2 w-28">SLA</th>
                <th className="text-left px-4 py-2 w-32">{t("common.date")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {t("common.loading")}
                  </td>
                </tr>
              )}
              {!isLoading && (data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {t("common.empty")}
                  </td>
                </tr>
              )}
              {/* @ts-ignore: Уберите игнор и пропишите интерфейс для 'd', если он есть в проекте */}
              {(data ?? []).map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-muted/40">
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
                  <td className="px-4 py-2"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-2"><SlaBadge sla={d.sla_status} /></td>
                  <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                    {fmtDateShort(d.created_at, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}