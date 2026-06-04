import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getTemplate, upsertTemplate } from "@/lib/api/templates.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates/$id")({
  component: TemplateEditor,
});

interface Field { key: string; label_ru: string; label_kk: string; type: "text" | "textarea" | "number" | "date"; required?: boolean }

function TemplateEditor() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: tpl } = useQuery({ queryKey: ["tpl", id], queryFn: () => getTemplate({ data: { id } }) });

  const [nameRu, setNameRu] = useState("");
  const [nameKk, setNameKk] = useState("");
  const [category, setCategory] = useState("general");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [fields, setFields] = useState<Field[]>([]);
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!tpl) return;
    setNameRu(tpl.name_ru); setNameKk(tpl.name_kk); setCategory(tpl.category);
    setStatus(tpl.status as "draft" | "published" | "archived");
    const s = tpl.schema as { fields?: Field[]; body_template?: string };
    setFields(s?.fields ?? []); setBody(s?.body_template ?? "");
  }, [tpl]);

  const save = useMutation({
    mutationFn: () =>
      upsertTemplate({
        data: {
          id, name_ru: nameRu, name_kk: nameKk, category, status,
          schema: { fields, body_template: body },
        },
      }),
    onSuccess: () => { toast.success("Сохранено"); qc.invalidateQueries({ queryKey: ["tpl", id] }); qc.invalidateQueries({ queryKey: ["tpls"] }); },
  });

  const addField = () => setFields((f) => [...f, { key: `field_${f.length + 1}`, label_ru: "Новое поле", label_kk: "Жаңа өріс", type: "text" }]);
  const update = (i: number, patch: Partial<Field>) => setFields((arr) => arr.map((f, idx) => idx === i ? { ...f, ...patch } : f));

  return (
    <>
      <PageHeader
        title={t("nav.templates")}
        actions={
          <>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("wf.draft")}</SelectItem>
                <SelectItem value="published">{t("wf.published")}</SelectItem>
                <SelectItem value="archived">{t("status.archived")}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{t("common.save")}</Button>
          </>
        }
      />
      <PageBody className="grid lg:grid-cols-2 gap-4 max-w-6xl">
        <Card className="rounded-sm">
          <CardHeader><CardTitle className="text-sm">{t("doc.metadata")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>{t("common.name")} (RU)</Label><Input value={nameRu} onChange={(e) => setNameRu(e.target.value)} /></div>
            <div><Label>{t("common.name")} (KK)</Label><Input value={nameKk} onChange={(e) => setNameKk(e.target.value)} /></div>
            <div><Label>Категория</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
            <div>
              <Label>{t("doc.body")} (используйте {`{{ключ_поля}}`} для подстановки)</Label>
              <Textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">{t("tpl.fields")}</CardTitle>
            <Button variant="outline" size="sm" onClick={addField}><Plus className="w-3 h-3 mr-1" />{t("tpl.add_field")}</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {fields.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">{t("common.empty")}</div>}
            {fields.map((f, i) => (
              <div key={i} className="border border-border rounded-sm p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="ключ" value={f.key} onChange={(e) => update(i, { key: e.target.value })} className="font-mono text-xs" />
                  <Select value={f.type} onValueChange={(v) => update(i, { type: v as Field["type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">text</SelectItem>
                      <SelectItem value="textarea">textarea</SelectItem>
                      <SelectItem value="number">number</SelectItem>
                      <SelectItem value="date">date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input placeholder="Подпись (RU)" value={f.label_ru} onChange={(e) => update(i, { label_ru: e.target.value })} />
                <Input placeholder="Подпись (KK)" value={f.label_kk} onChange={(e) => update(i, { label_kk: e.target.value })} />
                <Button variant="ghost" size="sm" onClick={() => setFields((arr) => arr.filter((_, idx) => idx !== i))}>
                  <Trash2 className="w-3 h-3 mr-1" />{t("common.delete")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
