import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useI18n, localized } from "@/lib/i18n";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDocument } from "@/lib/api/documents.functions";
import { listTemplates, generateFromTemplate } from "@/lib/api/templates.functions";
import { listNomenclature } from "@/lib/api/nomenclature.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents/new")({
  component: NewDocument,
});

function NewDocument() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState<string>("none");
  const { data: templates } = useQuery({ queryKey: ["tpls"], queryFn: () => listTemplates() });
  const { data: nomenclature } = useQuery({ queryKey: ["nom"], queryFn: () => listNomenclature() });

  const form = useForm<{
    title_ru: string;
    title_kk: string;
    summary: string;
    body: string;
    nomenclature_id: string;
    [k: string]: string;
  }>({
    defaultValues: { title_ru: "", title_kk: "", summary: "", body: "", nomenclature_id: "none" },
  });

  const selectedTpl = templates?.find((tp) => tp.id === templateId);
  const tplFields = (selectedTpl?.schema as { fields?: Array<{ key: string; label_ru: string; label_kk: string; type: string; required?: boolean }> } | undefined)?.fields ?? [];

  const mut = useMutation({
    mutationFn: async (vals: Record<string, string>) => {
      const nomenclature_id = vals.nomenclature_id && vals.nomenclature_id !== "none" ? vals.nomenclature_id : null;
      if (templateId && templateId !== "none") {
        const tplVals: Record<string, string> = {};
        tplFields.forEach((f) => { tplVals[f.key] = vals[f.key] ?? ""; });
        return generateFromTemplate({
          data: {
            template_id: templateId,
            values: tplVals,
            title_ru: vals.title_ru,
            title_kk: vals.title_kk || null,
            nomenclature_id,
          },
        });
      }
      return createDocument({
        data: {
          title_ru: vals.title_ru,
          title_kk: vals.title_kk || null,
          summary: vals.summary || null,
          body: vals.body || null,
          doc_type: "general",
          nomenclature_id,
        },
      });
    },
    onSuccess: (doc) => {
      toast.success(`Документ зарегистрирован: ${doc?.reg_number}`);
      if (doc?.id) navigate({ to: "/documents/$id", params: { id: doc.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <>
      <PageHeader title={t("doc.new")} />
      <PageBody>
        <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="max-w-3xl space-y-4">
          <Card className="rounded-sm">
            <CardHeader><CardTitle className="text-sm">{t("doc.metadata")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("doc.from_template")}</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger><SelectValue placeholder={t("doc.no_template")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("doc.no_template")}</SelectItem>
                      {(templates ?? []).filter((tp) => tp.status === "published").map((tp) => (
                        <SelectItem key={tp.id} value={tp.id}>{localized(tp, locale, "name")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("nav.nomenclature")}</Label>
                  <Select
                    value={form.watch("nomenclature_id")}
                    onValueChange={(v) => form.setValue("nomenclature_id", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {(nomenclature ?? []).map((n) => (
                        <SelectItem key={n.id} value={n.id}>{n.code} · {localized(n, locale, "title")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t("doc.title")} (RU) *</Label>
                <Input {...form.register("title_ru", { required: true })} />
              </div>
              <div>
                <Label>{t("doc.title")} (KK)</Label>
                <Input {...form.register("title_kk")} />
              </div>
              {templateId === "none" && (
                <>
                  <div>
                    <Label>{t("doc.summary")}</Label>
                    <Textarea rows={2} {...form.register("summary")} />
                  </div>
                  <div>
                    <Label>{t("doc.body")}</Label>
                    <Textarea rows={8} {...form.register("body")} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {selectedTpl && tplFields.length > 0 && (
            <Card className="rounded-sm">
              <CardHeader><CardTitle className="text-sm">{t("tpl.fields")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {tplFields.map((f) => (
                  <div key={f.key}>
                    <Label>{locale === "ru" ? f.label_ru : f.label_kk}{f.required && " *"}</Label>
                    {f.type === "textarea" ? (
                      <Textarea rows={4} {...form.register(f.key, { required: f.required })} />
                    ) : (
                      <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} {...form.register(f.key, { required: f.required })} />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? t("common.loading") : t("doc.register")}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/documents" })}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </PageBody>
    </>
  );
}
