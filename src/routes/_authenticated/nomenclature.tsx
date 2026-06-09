import { createFileRoute } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { listNomenclature, upsertNomenclature, deleteNomenclature } from "@/lib/api/nomenclature.functions";
import { getMyProfile, listDepartments } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import {
  ListEmpty,
  PageLoading,
  PageToolbar,
  PanelCard,
  SearchField,
} from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useI18n, localized, interpolate } from "@/i18n";
import {
  Plus,
  Trash2,
  Pencil,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Library,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/nomenclature")({
  beforeLoad: () => requireModule("nomenclature"),
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

type NomForm = {
  code: string;
  title_ru: string;
  title_kk: string;
  retention: number;
  archive_rule: string;
  sort_order: number;
  department_id: string;
};

const INITIAL_FORM: NomForm = {
  code: "",
  title_ru: "",
  title_kk: "",
  retention: 5,
  archive_rule: "5 лет",
  sort_order: 10,
  department_id: "none",
};

function NomenclaturePage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();

  const { data: items = [], isLoading, isError, error } = useQuery({
    queryKey: ["nom"],
    queryFn: () => listNomenclature(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["deps"],
    queryFn: () => listDepartments(),
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
  });

  const canManage =
    !!me?.roles?.includes("admin") || !!me?.permissions?.manage_nomenclature;

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [parent, setParent] = useState("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<NomForm>(INITIAL_FORM);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setParent("none");
    setForm(INITIAL_FORM);
  };

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
          sort_order: Number(form.sort_order),
        },
      }),
    onSuccess: () => {
      toast.success(editingId ? t("nom.saved") : t("nom.added"));
      closeDialog();
      qc.invalidateQueries({ queryKey: ["nom"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteNomenclature({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.success"));
      qc.invalidateQueries({ queryKey: ["nom"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

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
      department_id: item.department_id || "none",
    });
    setOpen(true);
  };

  const sorted = useMemo(
    () => ([...(items as NomItem[])] as NomItem[]).sort((a, b) => a.sort_order - b.sort_order),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((item) => {
      const title = localized(item, locale, "title").toLowerCase();
      return item.code.toLowerCase().includes(q) || title.includes(q);
    });
  }, [sorted, search, locale]);

  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    const byId = new Map(sorted.map((i) => [i.id, i]));

    for (const item of filtered) {
      let current: NomItem | undefined = item;
      while (current) {
        ids.add(current.id);
        current = current.parent_id ? byId.get(current.parent_id) : undefined;
      }
    }
    return ids;
  }, [filtered, sorted]);

  const byParent = useMemo(() => {
    const map = new Map<string | null, NomItem[]>();
    for (const item of sorted) {
      if (!visibleIds.has(item.id)) continue;
      const arr = map.get(item.parent_id) ?? [];
      arr.push(item);
      map.set(item.parent_id, arr);
    }
    return map;
  }, [sorted, visibleIds]);

  const renderNode = (item: NomItem, depth: number): ReactNode => {
    const children = byParent.get(item.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = search.trim() ? true : !!expanded[item.id];
    const itemDept = departments.find((d) => d.id === item.department_id);

    return (
      <div key={item.id}>
        <div
          className="flex items-center gap-2 border-b border-border/60 px-3 py-2 last:border-b-0 hover:bg-muted/40"
          style={{ paddingLeft: 12 + depth * 20 }}
        >
          <button
            type="button"
            className="flex h-4 w-4 shrink-0 items-center justify-center"
            onClick={() => hasChildren && toggleExpand(item.id)}
            aria-label={hasChildren ? (isExpanded ? "Свернуть" : "Развернуть") : undefined}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )
            ) : null}
          </button>

          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-primary" />
            )
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground/70" />
          )}

          <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{item.code}</span>

          <div className="flex min-w-0 flex-1 items-center gap-2 truncate">
            <span className="truncate text-sm">{localized(item, locale, "title")}</span>
            {itemDept && (
              <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                {localized(itemDept, locale, "name")}
              </Badge>
            )}
          </div>

          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {item.archive_rule || interpolate(t("nom.yearsSuffix"), { n: item.retention_years })}
          </span>

          {canManage && (
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => handleEditInit(item)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (window.confirm(t("nom.deleteConfirm"))) del.mutate(item.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {hasChildren && isExpanded && children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const roots = byParent.get(null) ?? [];

  return (
    <>
      <PageHeader
        title={t("nav.nomenclature")}
        description={t("nom.description")}
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              {t("nom.add_section")}
            </Button>
          ) : undefined
        }
      />

      <PageBody>
        <PageToolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("nom.search")}
            clearable
            className="max-w-md"
          />
          <Badge variant="outline" className="font-normal">
            {interpolate(t("nom.total"), { n: sorted.length })}
          </Badge>
        </PageToolbar>

        {isLoading ? (
          <PageLoading label={t("common.loading")} />
        ) : isError ? (
          <div className="rounded-sm border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : t("nom.loadError")}
          </div>
        ) : (
          <PanelCard>
            {roots.length === 0 ? (
              <ListEmpty>
                <Library className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p>{search.trim() ? t("nom.noResults") : t("nom.empty")}</p>
              </ListEmpty>
            ) : (
              <div className="divide-y divide-border/60">{roots.map((root) => renderNode(root, 0))}</div>
            )}
          </PanelCard>
        )}
      </PageBody>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto overflow-x-hidden sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t("nom.editSection") : t("nom.add_section")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label>{t("nom.parentSection")}</Label>
              <Select value={parent} onValueChange={setParent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("nom.root")}</SelectItem>
                  {sorted
                    .filter((i) => i.id !== editingId)
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.code} · {localized(i, locale, "title")}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("nom.departmentLink")}</Label>
              <Select
                value={form.department_id}
                onValueChange={(val) => setForm((f) => ({ ...f, department_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("nom.noDepartment")}</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code ? `${d.code} · ` : ""}
                      {localized(d, locale, "name")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label>{t("common.code")}</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="01-01"
                />
              </div>
              <div>
                <Label>{t("nom.sortOrder")}</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))
                  }
                />
              </div>
            </div>

            <div>
              <Label>{t("common.title")} (RU)</Label>
              <Input
                value={form.title_ru}
                onChange={(e) => setForm((f) => ({ ...f, title_ru: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("common.title")} (KK)</Label>
              <Input
                value={form.title_kk}
                onChange={(e) => setForm((f) => ({ ...f, title_kk: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("nom.retention")}</Label>
                <Input
                  type="number"
                  value={form.retention}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, retention: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>{t("nom.retentionText")}</Label>
                <Input
                  value={form.archive_rule}
                  onChange={(e) => setForm((f) => ({ ...f, archive_rule: e.target.value }))}
                  placeholder={t("nom.retentionPlaceholder")}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
