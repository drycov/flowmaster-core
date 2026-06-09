import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listDocuments } from "@/lib/api/documents.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { ListEmpty, PageToolbar, SearchField } from "@/components/PageLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

function SearchPage() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["search", q],
    queryFn: () => listDocuments({ data: { search: q, limit: 100 } }),
    enabled: q.length > 1,
  });

  const results = data ?? [];

  return (
    <>
      <PageHeader title={t("nav.search")} />
      <PageBody className="max-w-4xl">
        <PageToolbar>
          <SearchField
            value={q}
            onChange={setQ}
            placeholder={t("search.placeholder")}
            className="max-w-none"
            clearable
          />
        </PageToolbar>

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
