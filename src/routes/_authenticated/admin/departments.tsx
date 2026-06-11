import { createFileRoute } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { listDepartments, upsertDepartment, listUsers } from "@/lib/api/admin.functions";
import { ManageCatalogLink } from "@/components/references/ManageCatalogLink";
import { PageHeader, PageBody } from "@/components/AppShell";
import { ListEmpty, PageLoading, PanelCard } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n, localized } from "@/i18n";
import { Plus, Pencil, Building2, ChevronRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/departments")({
  beforeLoad: () => requireModule("admin_org"),
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

const emptyForm: Form = {
  parent_id: null,
  code: "",
  name_ru: "",
  name_kk: "",
  kind: "department",
  phone: "",
  email: "",
  head_user_id: null,
};

function DepartmentsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["deps"],
    queryFn: listDepartments,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);

  const selectedDep = departments.find((d) => d.id === selectedId);

  const saveMutation = useMutation({
    mutationFn: (data: Form) => upsertDepartment({ data }),
    onSuccess: () => {
      toast.success(t("common.success"));
      handleClose();
      qc.invalidateQueries({ queryKey: ["deps"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const updateField = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const openEdit = useCallback((d: Dep) => {
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
  }, []);

  const handleCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setForm(emptyForm);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id === selectedId ? null : id);
  };

  // Tree building
  const byParent = new Map<string | null, Dep[]>();
  departments.forEach((d) => {
    const key = d.parent_id ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(d);
    byParent.set(key, arr);
  });

  const renderNode = (d: Dep, depth: number): React.ReactNode => {
    const children = byParent.get(d.id) ?? [];
    const head = users.find((u) => u.id === d.head_user_id);
    const isSelected = d.id === selectedId;

    return (
      <div key={d.id}>
        <div
          className={`group flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors cursor-pointer ${
            isSelected ? "bg-primary/5 border-primary/20" : ""
          }`}
          style={{ paddingLeft: `${16 + depth * 28}px` }}
          onClick={() => handleSelect(d.id)}
        >
          {depth > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
          <Building2 className="w-5 h-5 text-primary shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                {d.code}
              </span>
              <span className="font-medium truncate">{localized(d, locale, "name")}</span>
            </div>
            {head && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {t("departments.headLabel")}: {localized(head, locale, "full_name") || head.email}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(d);
            }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
        </div>
        {children.map((child) => renderNode(child, depth + 1))}
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
          <div className="flex flex-wrap gap-2">
            <ManageCatalogLink catalogId="department-kinds" />
            <Button size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-1" />
              {t("common.create")}
            </Button>
          </div>
        }
      />

      <PageBody>
        <div className="flex gap-6 h-full">
          {/* Левая часть — дерево */}
          <PanelCard className="flex-1 max-w-2xl flex flex-col">
            {isLoading ? (
              <PageLoading />
            ) : roots.length === 0 ? (
              <ListEmpty>{t("common.empty")}</ListEmpty>
            ) : (
              <div className="divide-y divide-border overflow-auto flex-1">
                {roots.map((d) => renderNode(d, 0))}
              </div>
            )}
          </PanelCard>

          {/* Правая карточка с информацией */}
          {selectedDep ? (
            <PanelCard className="w-96 p-6 flex-shrink-0 self-start">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="font-mono text-sm text-muted-foreground mb-1">
                    {selectedDep.code}
                  </div>
                  <h2 className="text-xl font-semibold">
                    {localized(selectedDep, locale, "name")}
                  </h2>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-5">
                <div>
                  <Label className="text-xs text-muted-foreground">{t("departments.kind")}</Label>
                  <p className="capitalize">
                    {selectedDep.kind
                      ? t(`departments.kind.${selectedDep.kind}` as "departments.kind.company")
                      : "—"}
                  </p>
                </div>

                {selectedDep.parent_id && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t("departments.parent")}
                    </Label>
                    <p>
                      {departments.find((d) => d.id === selectedDep.parent_id)?.code} —{" "}
                      {localized(
                        departments.find((d) => d.id === selectedDep.parent_id),
                        locale,
                        "name",
                      )}
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-foreground">{t("departments.head")}</Label>
                  <p>
                    {users.find((u) => u.id === selectedDep.head_user_id)
                      ? localized(
                          users.find((u) => u.id === selectedDep.head_user_id)!,
                          locale,
                          "full_name",
                        ) || users.find((u) => u.id === selectedDep.head_user_id)!.email
                      : "—"}
                  </p>
                </div>

                {selectedDep.phone && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t("departments.phone")}
                    </Label>
                    <p>{selectedDep.phone}</p>
                  </div>
                )}

                {selectedDep.email && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t("departments.email")}
                    </Label>
                    <p>{selectedDep.email}</p>
                  </div>
                )}
              </div>

              <Button className="w-full mt-8" onClick={() => openEdit(selectedDep)}>
                <Pencil className="w-4 h-4 mr-2" />
                {t("common.edit")}
              </Button>
            </PanelCard>
          ) : (
            <PanelCard className="w-96 flex-shrink-0 self-start p-8 text-center text-muted-foreground">
              {t("departments.selectHint")}
            </PanelCard>
          )}
        </div>
      </PageBody>

      {/* Dialog редактирования (оставлен без изменений) */}
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {form.id ? t("common.edit") : t("departments.new")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {form.id ? t("departments.editDescription") : t("departments.newDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-x-6 gap-y-5 py-2">
            <div className="col-span-2 sm:col-span-1">
              <Label>{t("admin.departments.code")}</Label>
              <Input value={form.code} onChange={(e) => updateField("code", e.target.value)} />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <Label>{t("admin.departments.type")}</Label>
              <Select value={form.kind} onValueChange={(v) => updateField("kind", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">{t("departments.kind.company")}</SelectItem>
                  <SelectItem value="branch">{t("departments.kind.branch")}</SelectItem>
                  <SelectItem value="department">{t("departments.kind.department")}</SelectItem>
                  <SelectItem value="division">{t("departments.kind.division")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("wf.nameRu")}</Label>
              <Input
                value={form.name_ru}
                onChange={(e) => updateField("name_ru", e.target.value)}
              />
            </div>
            <div>
              <Label>{t("wf.nameKk")}</Label>
              <Input
                value={form.name_kk}
                onChange={(e) => updateField("name_kk", e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <Label>{t("departments.parent")}</Label>
              <Select
                value={form.parent_id ?? "__none"}
                onValueChange={(v) => updateField("parent_id", v === "__none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {departments
                    .filter((d) => d.id !== form.id)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.code} — {localized(d, locale, "name")}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>{t("departments.head")}</Label>
              <Select
                value={form.head_user_id ?? "__none"}
                onValueChange={(v) => updateField("head_user_id", v === "__none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {localized(u, locale, "full_name") || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("departments.phone")}</Label>
              <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
            </div>
            <div>
              <Label>{t("departments.email")}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
