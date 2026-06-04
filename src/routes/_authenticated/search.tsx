import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listDocuments } from "@/lib/api/documents.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { useI18n, localized } from "@/lib/i18n";
import { fmtDateShort } from "@/lib/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

function SearchPage() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["search", q],
    queryFn: () => listDocuments({ data: { search: q, limit: 100 } }),
    enabled: q.length > 1,
  });

  return (
    <>
      <PageHeader title={t("nav.search")} />
      <PageBody className="max-w-4xl">
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по номеру, заголовку, тексту..."
            className="pl-9 h-10"
          />
        </div>
        <div className="space-y-2">
          {(data ?? []).map((d) => (
            <Link key={d.id} to="/documents/$id" params={{ id: d.id }} className="block border border-border bg-card rounded-sm p-3 hover:border-primary transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">{d.reg_number}</div>
                  <div className="font-medium text-sm truncate">{localized(d, locale, "title")}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={d.status} />
                  <span className="text-xs text-muted-foreground">{fmtDateShort(d.created_at, locale)}</span>
                </div>
              </div>
            </Link>
          ))}
          {q.length > 1 && (data ?? []).length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">Ничего не найдено</div>}
          {q.length <= 1 && <div className="text-center py-8 text-sm text-muted-foreground">Введите запрос</div>}
        </div>
      </PageBody>
    </>
  );
}
