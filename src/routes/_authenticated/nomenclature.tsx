import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listNomenclature, upsertNomenclature, deleteNomenclature } from "@/lib/api/nomenclature.functions";
// Импортируйте функцию listDepartments из вашего файла функций (измените путь при необходимости)
import { listDepartments } from "@/lib/api/admin.functions"; 
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n, localized } from "@/lib/i18n";
import { Plus, Trash2, Pencil, Folder, FolderOpen, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/nomenclature")({
  component: NomenclaturePage,
});

interface NomItem { 
  id: string; 
  parent_id: string | null; 
  department_id: string | null; 
  code: string; 
  title_ru: string; 
  title_kk: string; 
  retention_years: number; 
  archive_rule: string;
  sort_order: number; 
}

const INITIAL_FORM = { 
  code: "", 
  title_ru: "", 
  title_kk: "", 
  retention: 5, 
  archive_rule: "5 лет", 
  sort_order: 10,
  department_id: "none"
};

function NomenclaturePage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  
  // Запросы данных из API
  const { data } = useQuery({ queryKey: ["nom"], queryFn: () => listNomenclature() });
  const { data: departmentsData } = useQuery({ queryKey: ["departments"], queryFn: () => listDepartments() });
  
  const departments = departmentsData ?? [];

  // Состояния интерфейса
  const [open, setOpen] = useState(false);
  const [parent, setParent] = useState<string>("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState(INITIAL_FORM);

  // Переключатель развернутых папок
  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Мутация создания/обновления
  const upsert = useMutation({
    mutationFn: () =>
      upsertNomenclature({
        data: {
          id: editingId || undefined,
          parent_id: parent === "none" ? null : parent,
          department_id: form.department_id === "none" ? null : form.department_id,
          code: form.code,
          title_ru: form.title_ru,
          title_kk: form.title_kk,
          retention_years: Number(form.retention),
          archive_rule: form.archive_rule,
          sort_order: Number(form.sort_order), // <-- ИСПРАВЛЕНО: добавлена отправка сортировки
        },
      }),
    onSuccess: () => {
      toast.success(editingId ? "Изменения сохранены" : "Добавлено");
      closeDialog();
      qc.invalidateQueries({ queryKey: ["nom"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteNomenclature({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nom"] }),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setParent("none");
    setForm(INITIAL_FORM);
  };

  const handleEditInit = (item: NomItem) => {
    setEditingId(item.id);
    setParent(item.parent_id || "none");
    setForm({
      code: item.code,
      title_ru: item.title_ru,
      title_kk: item.title_kk,
      retention: item.retention_years,
      archive_rule: item.archive_rule,
      sort_order: item.sort_order,
      department_id: item.department_id || "none"
    });
    setOpen(true);
  };

  // Дерево и сортировка
  const items = ((data ?? []) as NomItem[]).sort((a, b) => a.sort_order - b.sort_order);
  const byParent = new Map<string | null, NomItem[]>();
  items.forEach((i) => {
    const arr = byParent.get(i.parent_id) ?? [];
    arr.push(i);
    byParent.set(i.parent_id, arr);
  });

  // Рекурсивный рендер строки дерева
  const renderNode = (item: NomItem, depth: number): React.ReactNode => {
    const children = byParent.get(item.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = !!expanded[item.id];
    const itemDept = departments.find(d => d.id === item.department_id);

    return (
      <div key={item.id}>
        <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/40 rounded-sm" style={{ paddingLeft: 8 + depth * 20 }}>
          {/* Кнопка разворачивания */}
          <div className="w-4 h-4 flex items-center justify-center cursor-pointer" onClick={() => hasChildren && toggleExpand(item.id)}>
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />
            ) : null}
          </div>

          {/* Иконка папки */}
          {hasChildren ? (
            isExpanded ? <FolderOpen className="w-4 h-4 text-primary" /> : <Folder className="w-4 h-4 text-primary" />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground/70" />
          )}

          <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">{item.code}</span>
          
          <div className="text-sm flex-1 flex items-center gap-2 min-w-0 truncate">
            <span className="truncate">{localized(item, locale, "title")}</span>
            {itemDept && (
              <span className="text-[10px] px-2 py-0.5 bg-secondary text-secondary-foreground rounded font-medium shrink-0">
                {localized(itemDept, locale, "name")}
              </span>
            )}
          </div>

          <span className="text-xs text-muted-foreground shrink-0">{item.archive_rule || `${item.retention_years} лет`}</span>
          
          {/* Действия */}
          <div className="flex items-center gap-0.5 opacity-80 hover:opacity-100">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditInit(item)}>
              <Pencil className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => del.mutate(item.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Дочерние элементы отображаются только если узел развернут */}
        {hasChildren && isExpanded && (
          <div className="transition-all">
            {children.map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={t("nav.nomenclature")}
        actions={
          <Dialog open={open} onOpenChange={(v) => !v ? closeDialog() : setOpen(true)}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />{t("nom.add_section")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingId ? "Редактировать раздел" : t("nom.add_section")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                
                {/* Выбор родителя */}
                <div>
                  <Label>Родительский раздел</Label>
                  <Select value={parent} onValueChange={setParent}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— корневой —</SelectItem>
                      {items
                        .filter((i) => i.id !== editingId)
                        .map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.code} · {localized(i, locale, "title")}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Выбор департамента */}
                <div>
                  <Label>Привязка к департаменту</Label>
                  <Select 
                    value={form.department_id || "none"} 
                    onValueChange={(val) => setForm(f => ({ ...f, department_id: val }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Общий (без привязки) —</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.code ? `${d.code} · ` : ""}{localized(d, locale, "name")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label>{t("common.code")}</Label>
                    <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="01-01" />
                  </div>
                  <div>
                    <Label>Сортировка</Label>
                    <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
                  </div>
                </div>

                <div><Label>{t("common.title")} (RU)</Label><Input value={form.title_ru} onChange={(e) => setForm((f) => ({ ...f, title_ru: e.target.value }))} /></div>
                <div><Label>{t("common.title")} (KK)</Label><Input value={form.title_kk} onChange={(e) => setForm((f) => ({ ...f, title_kk: e.target.value }))} /></div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>{t("nom.retention")} (лет)</Label>
                    <Input type="number" value={form.retention} onChange={(e) => setForm((f) => ({ ...f, retention: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <Label>Срок хранения (текст)</Label>
                    <Input value={form.archive_rule} onChange={(e) => setForm((f) => ({ ...f, archive_rule: e.target.value }))} placeholder="Постоянно / 5 лет" />
                  </div>
                </div>

              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Отмена</Button>
                <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>{t("common.save")}</Button>
              </DialogFooter>
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