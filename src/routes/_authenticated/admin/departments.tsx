import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listDepartments, upsertDepartment } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useI18n, localized } from "@/lib/i18n";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/departments")({
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["deps"], queryFn: () => listDepartments() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name_ru: "", name_kk: "" });

  const create = useMutation({
    mutationFn: () => upsertDepartment({ data: form }),
    onSuccess: () => { toast.success("Создано"); setOpen(false); setForm({ code: "", name_ru: "", name_kk: "" }); qc.invalidateQueries({ queryKey: ["deps"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <>
      <PageHeader
        title={t("nav.departments")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />{t("common.create")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Новое подразделение</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("common.code")}</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></div>
                <div><Label>{t("common.name")} (RU)</Label><Input value={form.name_ru} onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))} /></div>
                <div><Label>{t("common.name")} (KK)</Label><Input value={form.name_kk} onChange={(e) => setForm((f) => ({ ...f, name_kk: e.target.value }))} /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>{t("common.save")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <PageBody>
        <div className="bg-card border border-border rounded-sm overflow-hidden max-w-3xl">
          <table className="w-full data-table">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2 w-32">{t("common.code")}</th>
              <th className="text-left px-4 py-2">{t("common.name")}</th>
            </tr></thead>
            <tbody>
              {(data ?? []).length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">{t("common.empty")}</td></tr>}
              {(data ?? []).map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{d.code}</td>
                  <td className="px-4 py-2 text-sm">{localized(d, locale, "name")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}
