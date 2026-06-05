import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listPositions, upsertPosition, deletePosition } from "@/lib/api/org.functions";
import { listDepartments } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useI18n, localized } from "@/lib/i18n";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/positions")({
  component: PositionsPage,
});

type Form = {
  id?: string;
  code: string;
  title_ru: string;
  title_kk: string;
  department_id: string | null;
  level: number;
  is_head: boolean;
};

const empty: Form = { code: "", title_ru: "", title_kk: "", department_id: null, level: 0, is_head: false };

function PositionsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["positions"], queryFn: () => listPositions() });
  const { data: deps } = useQuery({ queryKey: ["deps"], queryFn: () => listDepartments() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const save = useMutation({
    mutationFn: () => upsertPosition({ data: form }),
    onSuccess: () => {
      toast.success(t("common.success"));
      setOpen(false);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["positions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deletePosition({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.success"));
      qc.invalidateQueries({ queryKey: ["positions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const openEdit = (p: typeof data extends (infer X)[] | undefined ? X : never) => {
    setForm({
      id: p.id,
      code: p.code,
      title_ru: p.title_ru,
      title_kk: p.title_kk,
      department_id: p.department_id,
      level: p.level ?? 0,
      is_head: p.is_head ?? false,
    });
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title={t("nav.positions")}
        description={t("positions.description")}
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />{t("common.create")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{form.id ? t("common.edit") : t("positions.new")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("common.code")}</Label>
                  <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="dir, head_dep, specialist" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("positions.title")} (RU)</Label>
                    <Input value={form.title_ru} onChange={(e) => setForm((f) => ({ ...f, title_ru: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{t("positions.title")} (KK)</Label>
                    <Input value={form.title_kk} onChange={(e) => setForm((f) => ({ ...f, title_kk: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>{t("nav.departments")}</Label>
                  <Select value={form.department_id ?? "__none"} onValueChange={(v) => setForm((f) => ({ ...f, department_id: v === "__none" ? null : v }))}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {(deps ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>{localized(d, locale, "name")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <Label>{t("positions.level")}</Label>
                    <Input type="number" min={0} max={100} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) || 0 }))} />
                  </div>
                  <label className="flex items-center gap-2 pb-2 cursor-pointer">
                    <Checkbox checked={form.is_head} onCheckedChange={(c) => setForm((f) => ({ ...f, is_head: !!c }))} />
                    <span className="text-sm">{t("positions.isHead")}</span>
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <PageBody>
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2 w-32">{t("common.code")}</th>
                  <th className="text-left px-4 py-2">{t("positions.title")}</th>
                  <th className="text-left px-4 py-2">{t("nav.departments")}</th>
                  <th className="text-center px-4 py-2 w-20">{t("positions.level")}</th>
                  <th className="text-center px-4 py-2 w-24">{t("positions.isHead")}</th>
                  <th className="px-4 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {(data ?? []).length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-8">{t("common.empty")}</td></tr>
                )}
                {(data ?? []).map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-4 py-2 text-sm font-medium">{localized(p, locale, "title")}</td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">
                      {p.departments ? localized(p.departments, locale, "name") : "—"}
                    </td>
                    <td className="px-4 py-2 text-center text-sm">{p.level}</td>
                    <td className="px-4 py-2 text-center text-sm">{p.is_head ? "✓" : "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del.mutate(p.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </PageBody>
    </>
  );
}
