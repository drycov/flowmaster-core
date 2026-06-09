import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, localized } from "@/i18n";
import { requireModule } from "@/lib/access/route-guards";
import { listDocumentProjects, upsertDocumentProject } from "@/lib/api/projects.functions";
import { listDepartmentsBrief } from "@/lib/api/admin.functions";
import { listNomenclature } from "@/lib/api/nomenclature.functions";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { getMyProfile } from "@/lib/api/admin.functions";

export const Route = createFileRoute("/_authenticated/projects/")({
  beforeLoad: () => requireModule("projects"),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name_ru: "",
    name_kk: "",
    department_id: "",
    nomenclature_id: "",
  });

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMyProfile });
  const canManage =
    !!me?.permissions?.manage_projects || !!me?.permissions?.manage_documents;

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["document-projects", search],
    queryFn: () => listDocumentProjects({ data: { search: search || undefined } }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-brief"],
    queryFn: listDepartmentsBrief,
    enabled: open,
  });

  const { data: nomenclature = [] } = useQuery({
    queryKey: ["nom"],
    queryFn: listNomenclature,
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: () =>
      upsertDocumentProject({
        data: {
          code: form.code,
          name_ru: form.name_ru,
          name_kk: form.name_kk || form.name_ru,
          department_id: form.department_id || null,
          nomenclature_id: form.nomenclature_id || null,
        },
      }),
    onSuccess: (row) => {
      toast.success(t("project.created"));
      qc.invalidateQueries({ queryKey: ["document-projects"] });
      setOpen(false);
      setForm({ code: "", name_ru: "", name_kk: "", department_id: "", nomenclature_id: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("project.error")),
  });

  return (
    <>
      <PageHeader title={t("project.pageTitle")} description={t("project.pageSubtitle")} />
      <PageBody>
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex flex-wrap gap-2 justify-between">
            <Input
              className="max-w-xs"
              placeholder={t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {canManage && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    {t("project.create")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("project.create")}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <div>
                      <Label>{t("common.code")}</Label>
                      <Input
                        value={form.code}
                        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>{t("common.title")} (RU)</Label>
                      <Input
                        value={form.name_ru}
                        onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>{t("project.department")}</Label>
                      <Select
                        value={form.department_id || "none"}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, department_id: v === "none" ? "" : v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {localized(d, locale, "name") || d.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t("nav.nomenclature")}</Label>
                      <Select
                        value={form.nomenclature_id || "none"}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, nomenclature_id: v === "none" ? "" : v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {nomenclature.map((n: { id: string; code: string; title_ru: string; title_kk: string }) => (
                            <SelectItem key={n.id} value={n.id}>
                              {n.code} — {localized(n, locale, "title")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createMut.mutate()}
                      disabled={!form.code || !form.name_ru || createMut.isPending}
                    >
                      {t("common.save")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          <div className="space-y-2">
            {projects.map((p: {
              id: string;
              code: string;
              name_ru: string;
              name_kk: string;
              status: string;
              departments?: { name_ru: string; name_kk: string } | null;
              nomenclature_items?: { code: string; title_ru: string; title_kk: string } | null;
            }) => (
              <Card key={p.id}>
                <CardContent className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <Link
                      to="/projects/$id"
                      params={{ id: p.id }}
                      className="font-medium hover:underline flex items-center gap-2"
                    >
                      <FolderKanban className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                      {localized(p, locale, "name")}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-1">
                      {p.departments ? localized(p.departments, locale, "name") : null}
                      {p.nomenclature_items
                        ? ` · ${p.nomenclature_items.code} ${localized(p.nomenclature_items, locale, "title")}`
                        : null}
                    </div>
                  </div>
                  <StatusBadge status={p.status} kind="status" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </PageBody>
    </>
  );
}
