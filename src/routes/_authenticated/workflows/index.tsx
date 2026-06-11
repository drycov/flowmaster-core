import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listWorkflows, upsertWorkflow } from "@/lib/api/workflows.functions";
import { ManageCatalogLink } from "@/components/references/ManageCatalogLink";
import { PageHeader, PageBody } from "@/components/AppShell";
import { ListEmpty } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { useI18n, localized } from "@/i18n";
import { ruDictionary } from "@/i18n/locales/ru";
import { kkDictionary } from "@/i18n/locales/kk";
import { fmtDateShort } from "@/lib/format";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/workflows/")({
  beforeLoad: () => requireModule("workflows"),
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
          name_ru: ruDictionary["wf.newRoute"],
          name_kk: kkDictionary["wf.newRoute"],
          status: "draft",
          definition: {
            nodes: [
              {
                id: "start",
                type: "START",
                label: ruDictionary["wf.node.start"],
                position: { x: 50, y: 100 },
              },
              {
                id: "end",
                type: "END",
                label: ruDictionary["wf.node.end"],
                position: { x: 400, y: 100 },
              },
            ],
            edges: [{ id: "e1", source: "start", target: "end" }],
            schema_version: 2,
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
        actions={
          <div className="flex flex-wrap gap-2">
            <ManageCatalogLink catalogId="document-types" />
            <Button size="sm" onClick={() => create.mutate()}>
              <Plus className="w-4 h-4 mr-1" />
              {t("common.create")}
            </Button>
          </div>
        }
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
                    {w.status === "published" ? t("wf.status.published") : t("wf.status.draft")}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-3">
                  {fmtDateShort(w.updated_at, locale)} · v{w.version}
                </div>
              </div>
            </Link>
          ))}
          {(data ?? []).length === 0 && (
            <div className="col-span-2">
              <ListEmpty>{t("common.empty")}</ListEmpty>
            </div>
          )}
        </div>
      </PageBody>
    </>
  );
}
