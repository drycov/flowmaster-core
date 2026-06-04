import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listTemplates, upsertTemplate } from "@/lib/api/templates.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useI18n, localized } from "@/lib/i18n";
import { fmtDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/templates/")({
  component: TemplatesList,
});

function TemplatesList() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["tpls"], queryFn: () => listTemplates() });

  const create = useMutation({
    mutationFn: () =>
      upsertTemplate({
        data: {
          name_ru: "Новый шаблон",
          name_kk: "Жаңа үлгі",
          category: "general",
          status: "draft",
          schema: { fields: [], body_template: "Документ\n\n{{поле1}}\n" },
        },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["tpls"] });
      if (r?.id) navigate({ to: "/templates/$id", params: { id: r.id } });
    },
  });

  return (
    <>
      <PageHeader
        title={t("nav.templates")}
        actions={<Button size="sm" onClick={() => create.mutate()}><Plus className="w-4 h-4 mr-1" />{t("common.create")}</Button>}
      />
      <PageBody>
        <div className="grid lg:grid-cols-3 gap-3">
          {(data ?? []).map((tp) => (
            <Link key={tp.id} to="/templates/$id" params={{ id: tp.id }}>
              <div className="border border-border bg-card rounded-sm p-4 hover:border-primary transition-colors">
                <div className="flex items-start justify-between">
                  <div className="font-medium text-sm">{localized(tp, locale, "name")}</div>
                  <Badge variant="outline" className="text-[10px] uppercase">{tp.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{tp.category}</div>
                <div className="text-xs text-muted-foreground mt-3">{fmtDateShort(tp.updated_at, locale)} · v{tp.version}</div>
              </div>
            </Link>
          ))}
          {(data ?? []).length === 0 && <div className="col-span-3 text-center py-12 text-muted-foreground text-sm">{t("common.empty")}</div>}
        </div>
      </PageBody>
    </>
  );
}
