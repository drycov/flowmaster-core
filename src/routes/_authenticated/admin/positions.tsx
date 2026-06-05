import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { listPositions, upsertPosition, deletePosition } from "@/lib/api/org.functions";
import { listDepartments } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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

const emptyForm: Form = {
  code: "",
  title_ru: "",
  title_kk: "",
  department_id: null,
  level: 0,
  is_head: false,
};

function PositionsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: listPositions,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["deps"],
    queryFn: listDepartments,
  });

  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [isDirty, setIsDirty] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (data: Form) => upsertPosition({ data }),
    onSuccess: () => {
      toast.success(t("common.success"));
      handleClose();
      qc.invalidateQueries({ queryKey: ["positions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePosition({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.success"));
      qc.invalidateQueries({ queryKey: ["positions"] });
      setDeleteId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const updateField = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const openEdit = useCallback((p: any) => {
    setForm({
      id: p.id,
      code: p.code,
      title_ru: p.title_ru,
      title_kk: p.title_kk,
      department_id: p.department_id,
      level: p.level ?? 0,
      is_head: p.is_head ?? false,
    });
    setIsDirty(false);
    setOpen(true);
  }, []);

  const handleClose = () => {
    setOpen(false);
    setForm(emptyForm);
    setIsDirty(false);
  };

  const handleCreate = () => {
    setForm(emptyForm);
    setIsDirty(false);
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title={t("nav.positions")}
        description={t("positions.description")}
        actions={
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" />
            {t("common.create")}
          </Button>
        }
      />

      <PageBody>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 w-32">{t("common.code")}</th>
                  <th className="text-left px-4 py-3">{t("positions.title")}</th>
                  <th className="text-left px-4 py-3">{t("nav.departments")}</th>
                  <th className="text-center px-4 py-3 w-20">{t("positions.level")}</th>
                  <th className="text-center px-4 py-3 w-24">{t("positions.isHead")}</th>
                  <th className=" px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-12">
                      {t("common.empty")}
                    </td>
                  </tr>
                )}
                {positions.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4  font-mono text-xs">{p.code}</td>
                    <td className="px-4  text-sm font-medium">
                      {localized(p, locale, "title")}
                    </td>
                    <td className="px-4  text-sm text-muted-foreground">
                      {p.departments ? localized(p.departments, locale, "name") : "—"}
                    </td>
                    <td className="px-4  text-center text-sm font-medium">{p.level}</td>
                    <td className="px-4  text-center text-sm">
                      {p.is_head ? "✓" : "—"}
                    </td>
                    <td className="px-4  text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(p.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </PageBody>

      {/* Edit / Create Dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
            <DialogContent   className="w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>
              {form.id ? t("common.edit") : t("positions.new")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>{t("common.code")}</Label>
              <Input
                value={form.code}
                onChange={(e) => updateField("code", e.target.value)}
                placeholder="director, specialist, manager"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("positions.title")} (RU)</Label>
                <Input
                  value={form.title_ru}
                  onChange={(e) => updateField("title_ru", e.target.value)}
                />
              </div>
              <div>
                <Label>{t("positions.title")} (KK)</Label>
                <Input
                  value={form.title_kk}
                  onChange={(e) => updateField("title_kk", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>{t("nav.departments")}</Label>
              <Select
                value={form.department_id ?? "__none"}
                onValueChange={(v) => updateField("department_id", v === "__none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {localized(d, locale, "name")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <Label>{t("positions.level")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.level}
                  onChange={(e) => updateField("level", Number(e.target.value) || 0)}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-6">
                <Checkbox
                  checked={form.is_head}
                  onCheckedChange={(c) => updateField("is_head", !!c)}
                />
                <span className="text-sm">{t("positions.isHead")}</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить должность?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Должность будет удалена безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}