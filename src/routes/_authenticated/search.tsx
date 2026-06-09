import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listDocuments } from "@/lib/api/documents.functions";
import {
  deleteSavedSearch,
  listSavedSearches,
  saveSearch,
  type SavedSearchQuery,
} from "@/lib/api/saved-searches.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { ListEmpty, PageToolbar, SearchField } from "@/components/PageLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";
import { Bookmark, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

function SearchPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [scope, setScope] = useState<"all" | "mine" | "assigned">("all");
  const [saveName, setSaveName] = useState("");

  const queryPayload: SavedSearchQuery = {
    search: q || undefined,
    status: status === "all" ? undefined : status,
    scope: scope === "all" ? undefined : scope,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["search", q, status, scope],
    queryFn: () =>
      listDocuments({
        data: {
          search: q || undefined,
          status: status === "all" ? undefined : status,
          scope: scope === "all" ? undefined : scope,
          limit: 100,
        },
      }),
    enabled: q.length > 1,
  });

  const { data: saved = [] } = useQuery({
    queryKey: ["saved-searches"],
    queryFn: listSavedSearches,
  });

  const saveMutation = useMutation({
    mutationFn: () => saveSearch({ data: { name: saveName.trim(), query: queryPayload } }),
    onSuccess: () => {
      toast.success(t("search.saved"));
      setSaveName("");
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSavedSearch({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });

  const applySaved = (query: SavedSearchQuery) => {
    setQ(query.search ?? "");
    setStatus(query.status ?? "all");
    setScope((query.scope as typeof scope) ?? "all");
  };

  const results = data ?? [];

  return (
    <>
      <PageHeader title={t("nav.search")} />
      <PageBody className="max-w-4xl">
        <PageToolbar className="flex-wrap gap-2">
          <SearchField
            value={q}
            onChange={setQ}
            placeholder={t("search.placeholder")}
            className="max-w-none flex-1 min-w-[200px]"
            clearable
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="draft">{t("status.draft")}</SelectItem>
              <SelectItem value="in_review">{t("status.in_review")}</SelectItem>
              <SelectItem value="approved">{t("status.approved")}</SelectItem>
              <SelectItem value="archived">{t("status.archived")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="mine">{t("scope.mine")}</SelectItem>
              <SelectItem value="assigned">{t("scope.assigned")}</SelectItem>
            </SelectContent>
          </Select>
        </PageToolbar>

        {q.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={t("search.saveName")}
              className="max-w-xs h-9"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!saveName.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Bookmark className="w-3 h-3 mr-1" />
              {t("search.save")}
            </Button>
          </div>
        )}

        {saved.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {saved.map((s) => (
              <div
                key={s.id}
                className="inline-flex items-center gap-1 border rounded-sm px-2 py-1 text-xs bg-muted/30"
              >
                <button
                  type="button"
                  className="hover:text-primary"
                  onClick={() => applySaved(s.query as SavedSearchQuery)}
                >
                  {s.name}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(s.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {isLoading && <ListEmpty>{t("common.loading")}</ListEmpty>}
        {!isLoading && q.length <= 1 && <ListEmpty>{t("search.enterQuery")}</ListEmpty>}
        {!isLoading && q.length > 1 && results.length === 0 && (
          <ListEmpty>{t("search.noResults")}</ListEmpty>
        )}

        <div className="space-y-2">
          {results.map((d) => (
            <Link
              key={d.id}
              to="/documents/$id"
              params={{ id: d.id }}
              className="block border border-border bg-card rounded-sm p-3 hover:border-primary transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">
                    {d.reg_number}
                    {"external_reg_number" in d && d.external_reg_number
                      ? ` · ${d.external_reg_number}`
                      : ""}
                  </div>
                  <div className="font-medium text-sm truncate">
                    {localized(d, locale, "title")}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={d.status} />
                  <span className="text-xs text-muted-foreground">
                    {fmtDateShort(d.created_at, locale)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </PageBody>
    </>
  );
}
