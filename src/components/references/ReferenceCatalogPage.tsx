import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/AppShell";
import { DataTableShell, PageLoading, SearchField, TableStatusRow } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n, localized } from "@/i18n";
import type { RefCatalogDef, RefFieldDef } from "@/lib/references/catalogs";
import {
  deleteReferenceRow,
  listArchiveLocationsBrief,
  listDocumentTypesBrief,
  listReferenceCatalog,
  upsertReferenceRow,
} from "@/lib/api/references.functions";
import { listDepartments } from "@/lib/api/admin.functions";
import { getMyProfile } from "@/lib/api/admin.functions";

type Row = Record<string, unknown>;

function defaultValue(field: RefFieldDef): unknown {
  switch (field.type) {
    case "is_active":
    case "is_permanent":
    case "boolean":
      return false;
    case "sort_order":
    case "level_order":
    case "years":
    case "sla_hours":
    case "number":
      return 0;
    default:
      return "";
  }
}

function buildEmptyForm(catalog: RefCatalogDef): Row {
  const form: Row = {};
  for (const f of catalog.fields) {
    form[f.key] = defaultValue(f);
  }
  return form;
}

function fieldLabel(t: (k: string) => string, field: RefFieldDef): string {
  switch (field.type) {
    case "code":
      return t("common.code");
    case "name":
      return field.key.endsWith("_kk") ? `${t("ref.name")} (KK)` : `${t("ref.name")} (RU)`;
    case "description":
      return field.key.endsWith("_kk") ? `${t("ref.description")} (KK)` : `${t("ref.description")} (RU)`;
    case "sort_order":
      return t("ref.sortOrder");
    case "is_active":
      return t("ref.isActive");
    case "is_permanent":
      return t("ref.isPermanent");
    case "level_order":
      return t("ref.levelOrder");
    case "sla_hours":
      return t("ref.slaHours");
    case "prefix":
      return t("ref.prefix");
    case "select_document_type":
      return t("ref.documentType");
    case "select_department":
      return t("nav.departments");
    case "select_parent_location":
      return t("ref.parentLocation");
    case "years":
      return t("ref.years");
    case "color":
      return t("ref.color");
    default:
      return field.key;
  }
}

function formatCellValue(
  row: Row,
  field: RefFieldDef,
  locale: "ru" | "kk",
  t: (k: string) => string,
): string {
  const v = row[field.key];
  if (field.type === "is_active" || field.type === "is_permanent" || field.type === "boolean") {
    return v ? "✓" : "—";
  }
  if (field.type === "name" || field.key === "name_ru" || field.key === "name_kk") {
    if (field.key === "name_ru" || field.key === "name_kk") {
      return String(v ?? "");
    }
    return localized(row as { name_ru?: string; name_kk?: string }, locale, "name") || "—";
  }
  if (field.type === "select_document_type" && row.ref_document_types) {
    const dt = row.ref_document_types as { name_ru?: string; name_kk?: string };
    return localized(dt, locale, "name") || "—";
  }
  if (field.type === "select_department" && row.departments) {
    const d = row.departments as { name_ru?: string; name_kk?: string };
    return localized(d, locale, "name") || "—";
  }
  if (field.type === "select_parent_location" && row.parent) {
    const p = row.parent as { name_ru?: string; name_kk?: string };
    return localized(p, locale, "name") || "—";
  }
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export function ReferenceCatalogPage({ catalog }: { catalog: RefCatalogDef }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const roles = me?.roles ?? [];
  const perms = me?.permissions ?? {};
  const canManage = roles.includes("admin") || !!perms.manage_references;

  const listFields = catalog.fields.filter((f) => f.list);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ref-catalog", catalog.id],
    queryFn: () => listReferenceCatalog({ data: { catalogId: catalog.id } }),
  });

  const { data: documentTypes = [] } = useQuery({
    queryKey: ["ref-document-types-brief"],
    queryFn: listDocumentTypesBrief,
    enabled: catalog.fields.some((f) => f.type === "select_document_type"),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["deps"],
    queryFn: listDepartments,
    enabled: catalog.fields.some((f) => f.type === "select_department"),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["ref-locations-brief"],
    queryFn: listArchiveLocationsBrief,
    enabled: catalog.fields.some((f) => f.type === "select_parent_location"),
  });

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Row>(() => buildEmptyForm(catalog));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows as Row[];
    return (rows as Row[]).filter((row) => {
      const hay = [
        row.code,
        row.name_ru,
        row.name_kk,
        row.bin,
        row.contact_person,
        row.prefix,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const saveMutation = useMutation({
    mutationFn: (data: Row) =>
      upsertReferenceRow({ data: { catalogId: catalog.id, row: data } }),
    onSuccess: () => {
      toast.success(t("common.success"));
      handleClose();
      qc.invalidateQueries({ queryKey: ["ref-catalog", catalog.id] });
      qc.invalidateQueries({ queryKey: ["ref-locations-brief"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReferenceRow({ data: { catalogId: catalog.id, id } }),
    onSuccess: () => {
      toast.success(t("common.success"));
      qc.invalidateQueries({ queryKey: ["ref-catalog", catalog.id] });
      setDeleteId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const updateField = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const openEdit = useCallback(
    (row: Row) => {
      const next = buildEmptyForm(catalog);
      for (const f of catalog.fields) {
        if (row[f.key] !== undefined) next[f.key] = row[f.key];
      }
      if (row.id) next.id = row.id;
      setForm(next);
      setOpen(true);
    },
    [catalog],
  );

  const handleClose = () => {
    setOpen(false);
    setForm(buildEmptyForm(catalog));
  };

  const handleCreate = () => {
    setForm(buildEmptyForm(catalog));
    setOpen(true);
  };

  const renderFieldInput = (field: RefFieldDef) => {
    const value = form[field.key];

    if (field.type === "is_active" || field.type === "is_permanent" || field.type === "boolean") {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={!!value} onCheckedChange={(c) => updateField(field.key, !!c)} />
          <span className="text-sm">{fieldLabel(t, field)}</span>
        </label>
      );
    }

    if (field.type === "select_document_type") {
      return (
        <div>
          <Label>{fieldLabel(t, field)}</Label>
          <Select
            value={(value as string) ?? "__none"}
            onValueChange={(v) => updateField(field.key, v === "__none" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">—</SelectItem>
              {documentTypes.map((dt) => (
                <SelectItem key={dt.id} value={dt.id}>
                  {localized(dt, locale, "name")} ({dt.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === "select_department") {
      return (
        <div>
          <Label>{fieldLabel(t, field)}</Label>
          <Select
            value={(value as string) ?? "__none"}
            onValueChange={(v) => updateField(field.key, v === "__none" ? null : v)}
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
      );
    }

    if (field.type === "select_parent_location") {
      return (
        <div>
          <Label>{fieldLabel(t, field)}</Label>
          <Select
            value={(value as string) ?? "__none"}
            onValueChange={(v) => updateField(field.key, v === "__none" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">—</SelectItem>
              {locations
                .filter((loc) => loc.id !== form.id)
                .map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {localized(loc, locale, "name")} ({loc.code})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (
      field.type === "sort_order" ||
      field.type === "level_order" ||
      field.type === "years" ||
      field.type === "sla_hours" ||
      field.type === "number"
    ) {
      return (
        <div>
          <Label>{fieldLabel(t, field)}</Label>
          <Input
            type="number"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => updateField(field.key, e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
      );
    }

    return (
      <div>
        <Label>{fieldLabel(t, field)}</Label>
        <Input
          value={String(value ?? "")}
          onChange={(e) => updateField(field.key, e.target.value)}
        />
      </div>
    );
  };

  const formFields = catalog.fields.filter((f) => {
    if (f.key === "name_kk" && catalog.fields.some((x) => x.key === "name_ru")) return true;
    return true;
  });

  const nameRuField = catalog.fields.find((f) => f.key === "name_ru");
  const nameKkField = catalog.fields.find((f) => f.key === "name_kk");
  const pairedName = nameRuField && nameKkField;

  return (
    <>
      <PageHeader
        title={t(catalog.titleKey)}
        description={t(catalog.descriptionKey)}
        actions={
          canManage ? (
            <Button size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-1" />
              {t("common.create")}
            </Button>
          ) : undefined
        }
      />

      <PageBody>
        <div className="mb-3">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("ref.searchPlaceholder")}
            clearable
          />
        </div>

        <DataTableShell>
          {isLoading ? (
            <PageLoading />
          ) : (
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {listFields.map((f) => (
                    <th key={f.key} className="text-left px-4 py-2 text-sm font-medium">
                      {fieldLabel(t, f)}
                    </th>
                  ))}
                  {canManage && <th className="px-4 py-2 w-24" />}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <TableStatusRow colSpan={listFields.length + (canManage ? 1 : 0)}>
                    {t("common.empty")}
                  </TableStatusRow>
                )}
                {filtered.map((row) => (
                  <tr key={String(row.id)} className="border-t border-border hover:bg-muted/30">
                    {listFields.map((f) => (
                      <td key={f.key} className="px-4 py-2 text-sm">
                        {f.key === "name_ru"
                          ? localized(row as { name_ru?: string; name_kk?: string }, locale, "name")
                          : formatCellValue(row, f, locale, t)}
                      </td>
                    ))}
                    {canManage && (
                      <td className="px-4 py-2 text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(String(row.id))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataTableShell>
      </PageBody>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? t("common.edit") : t("common.create")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formFields.map((field) => {
              if (pairedName && field.key === "name_kk") return null;
              if (pairedName && field.key === "name_ru") {
                return (
                  <div key="names" className="grid grid-cols-2 gap-3">
                    <div>{renderFieldInput(nameRuField!)}</div>
                    <div>{renderFieldInput(nameKkField!)}</div>
                  </div>
                );
              }
              const descRu = catalog.fields.find((f) => f.key === "description_ru");
              const descKk = catalog.fields.find((f) => f.key === "description_kk");
              if (descRu && descKk && field.key === "description_kk") return null;
              if (descRu && descKk && field.key === "description_ru") {
                return (
                  <div key="desc" className="grid grid-cols-2 gap-3">
                    <div>{renderFieldInput(descRu)}</div>
                    <div>{renderFieldInput(descKk)}</div>
                  </div>
                );
              }
              return <div key={field.key}>{renderFieldInput(field)}</div>;
            })}
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ref.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("ref.deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
