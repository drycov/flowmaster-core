import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listDepartments, upsertDepartment, listUsers } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useI18n, localized } from "@/lib/i18n";
import { Plus, Pencil, Building2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/departments")({
  component: DepartmentsPage,
});

type Dep = {
  id: string;
  parent_id: string | null;
  code: string;
  name_ru: string;
  name_kk: string;
  kind?: string | null;
  phone?: string | null;
  email?: string | null;
  head_user_id?: string | null;
};

type Form = {
  id?: string;
  parent_id: string | null;
  code: string;
  name_ru: string;
  name_kk: string;
  kind: string;
  phone: string;
  email: string;
  head_user_id: string | null;
};

const empty: Form = {
  parent_id: null, code: "", name_ru: "", name_kk: "",
  kind: "department", phone: "", email: "", head_user_id: null,
};

function DepartmentsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["deps"], queryFn: () => listDepartments() });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => listUsers() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const save = useMutation({
    mutationFn: () => upsertDepartment({ data: form }),
    onSuccess: () => {
      toast.success(t("common.success"));
      setOpen(false); setForm(empty);
      qc.invalidateQueries({ queryKey: ["deps"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const openEdit = (d: Dep) => {
    setForm({
      id: d.id,
      parent_id: d.parent_id,
      code: d.code,
      name_ru: d.name_ru,
      name_kk: d.name_kk,
      kind: d.kind ?? "department",
      phone: d.phone ?? "",
      email: d.email ?? "",
      head_user_id: d.head_user_id ?? null,
    });
    setOpen(true);
  };

  // Build tree
  const deps = (data ?? []) as Dep[];
  const byParent = new Map<string | null, Dep[]>();
  deps.forEach((d) => {
    const k = d.parent_id ?? null;
    const arr = byParent.get(k) ?? [];
    arr.push(d);
    byParent.set(k, arr);
  });

  const renderNode = (d: Dep, depth: number): React.ReactNode => {
    const children = byParent.get(d.id) ?? [];
    const head = users?.find((u) => u.id === d.head_user_id);
    return (
      <div key={d.id}>
        <div
          className="flex items-center gap-2 px-3 py-2 border-b border-border hover:bg-muted/30 text-sm"
          style={{ paddingLeft: 12 + depth * 20 }}
        >
          {depth > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          <Building2 className="w-4 h-4 text-primary shrink-0" />
          <span className="font-mono text-[11px] text-muted-foreground w-20 shrink-0">{d.code}</span>
          <span className="font-medium flex-1">{localized(d, locale, "name")}</span>
          {head && <span className="text-xs text-muted-foreground hidden md:inline">{localized(head, locale, "full_name") || head.email}</span>}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  const roots = byParent.get(null) ?? [];

  return (
    <>
      <PageHeader
        title={t("nav.departments")}
        description={t("departments.description")}
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />{t("common.create")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{form.id ? t("common.edit") : t("departments.new")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("common.code")}</Label>
                    <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{t("departments.kind")}</Label>
                    <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">{t("departments.kind.company")}</SelectItem>
                        <SelectItem value="branch">{t("departments.kind.branch")}</SelectItem>
                        <SelectItem value="department">{t("departments.kind.department")}</SelectItem>
                        <SelectItem value="division">{t("departments.kind.division")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("common.name")} (RU)</Label><Input value={form.name_ru} onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))} /></div>
                  <div><Label>{t("common.name")} (KK)</Label><Input value={form.name_kk} onChange={(e) => setForm((f) => ({ ...f, name_kk: e.target.value }))} /></div>
                </div>
                <div>
                  <Label>{t("departments.parent")}</Label>
                  <Select value={form.parent_id ?? "__none"} onValueChange={(v) => setForm((f) => ({ ...f, parent_id: v === "__none" ? null : v }))}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {deps.filter((d) => d.id !== form.id).map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.code} — {localized(d, locale, "name")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("departments.head")}</Label>
                  <Select value={form.head_user_id ?? "__none"} onValueChange={(v) => setForm((f) => ({ ...f, head_user_id: v === "__none" ? null : v }))}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {(users ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>{localized(u, locale, "full_name") || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("org.phone")}</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
                  <div><Label>{t("org.email")}</Label><Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("common.save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <PageBody>
        <div className="bg-card border border-border rounded-sm overflow-hidden max-w-4xl">
          {roots.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">{t("common.empty")}</div>
          )}
          {roots.map((d) => renderNode(d, 0))}
        </div>
      </PageBody>
    </>
  );
}
