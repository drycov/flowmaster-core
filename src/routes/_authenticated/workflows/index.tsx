import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listWorkflows, upsertWorkflow } from "@/lib/api/workflows.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useI18n, localized } from "@/lib/i18n";
import { fmtDateShort } from "@/lib/format";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/workflows/")({
  component: WorkflowsList,
});

function WorkflowsList() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["wfs"], queryFn: () => listWorkflows() });

  const create = useMutation({
    mutationFn: () =>
      upsertWorkflow({
        data: {
          name_ru: "Новый маршрут",
          name_kk: "Жаңа бағыт",
          status: "draft",
          definition: {
            nodes: [
              { id: "start", type: "START", label: "Начало", position: { x: 50, y: 100 } },
              { id: "end", type: "END", label: "Конец", position: { x: 400, y: 100 } },
            ],
            edges: [{ id: "e1", source: "start", target: "end" }],
          },
        },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["wfs"] });
      if (r?.id) navigate({ to: "/workflows/$id", params: { id: r.id } });
    },
  });

  return (
    <>
      <PageHeader
        title={t("nav.workflows")}
        actions={<Button size="sm" onClick={() => create.mutate()}><Plus className="w-4 h-4 mr-1" />{t("common.create")}</Button>}
      />
      <PageBody>
        <div className="grid lg:grid-cols-2 gap-3">
          {(data ?? []).map((w) => (
            <Link key={w.id} to="/workflows/$id" params={{ id: w.id }} className="block">
              <div className="border border-border bg-card rounded-sm p-4 hover:border-primary transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{localized(w, locale, "name")}</div>
                    <div className="text-xs text-muted-foreground mt-1">{w.description || "—"}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {w.status === "published" ? t("wf.published") : t("wf.draft")}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-3">{fmtDateShort(w.updated_at, locale)} · v{w.version}</div>
              </div>
            </Link>
          ))}
          {(data ?? []).length === 0 && (
            <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">{t("common.empty")}</div>
          )}
        </div>
      </PageBody>
    </>
  );
}
