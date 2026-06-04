import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listNomenclature, upsertNomenclature, deleteNomenclature } from "@/lib/api/nomenclature.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n, localized } from "@/lib/i18n";
import { Plus, Trash2, Folder, FolderOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/nomenclature")({
  component: NomenclaturePage,
});

interface NomItem { id: string; parent_id: string | null; code: string; title_ru: string; title_kk: string; retention_years: number; archive_rule: string }

function NomenclaturePage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["nom"], queryFn: () => listNomenclature() });
  const [open, setOpen] = useState(false);
  const [parent, setParent] = useState<string>("none");
  const [form, setForm] = useState({ code: "", title_ru: "", title_kk: "", retention: 5 });

  const upsert = useMutation({
    mutationFn: () =>
      upsertNomenclature({
        data: {
          parent_id: parent === "none" ? null : parent,
          code: form.code,
          title_ru: form.title_ru,
          title_kk: form.title_kk,
          retention_years: Number(form.retention),
          archive_rule: "standard",
        },
      }),
    onSuccess: () => {
      toast.success("Добавлено");
      setOpen(false);
      setForm({ code: "", title_ru: "", title_kk: "", retention: 5 });
      qc.invalidateQueries({ queryKey: ["nom"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteNomenclature({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nom"] }),
  });

  // tree build
  const items = (data ?? []) as NomItem[];
  const byParent = new Map<string | null, NomItem[]>();
  items.forEach((i) => {
    const arr = byParent.get(i.parent_id) ?? [];
    arr.push(i);
    byParent.set(i.parent_id, arr);
  });

  const renderNode = (item: NomItem, depth: number): React.ReactNode => {
    const children = byParent.get(item.id) ?? [];
    return (
      <div key={item.id}>
        <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/40 rounded-sm" style={{ paddingLeft: 8 + depth * 20 }}>
          {children.length ? <FolderOpen className="w-4 h-4 text-primary" /> : <Folder className="w-4 h-4 text-muted-foreground" />}
          <span className="font-mono text-xs text-muted-foreground w-20">{item.code}</span>
          <span className="text-sm flex-1">{localized(item, locale, "title")}</span>
          <span className="text-xs text-muted-foreground">{item.retention_years} {t("nom.retention").includes("(") ? "" : "лет"}</span>
          <Button variant="ghost" size="sm" onClick={() => del.mutate(item.id)}><Trash2 className="w-3 h-3" /></Button>
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={t("nav.nomenclature")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />{t("nom.add_section")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("nom.add_section")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Родительский раздел</Label>
                  <Select value={parent} onValueChange={setParent}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— корневой —</SelectItem>
                      {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.code} · {localized(i, locale, "title")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t("common.code")}</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="01-01" /></div>
                <div><Label>{t("common.title")} (RU)</Label><Input value={form.title_ru} onChange={(e) => setForm((f) => ({ ...f, title_ru: e.target.value }))} /></div>
                <div><Label>{t("common.title")} (KK)</Label><Input value={form.title_kk} onChange={(e) => setForm((f) => ({ ...f, title_kk: e.target.value }))} /></div>
                <div><Label>{t("nom.retention")}</Label><Input type="number" value={form.retention} onChange={(e) => setForm((f) => ({ ...f, retention: Number(e.target.value) }))} /></div>
              </div>
              <DialogFooter><Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>{t("common.save")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <PageBody>
        <div className="bg-card border border-border rounded-sm p-2">
          {items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t("common.empty")}</div>
          ) : (
            (byParent.get(null) ?? []).map((root) => renderNode(root, 0))
          )}
        </div>
      </PageBody>
    </>
  );
}
