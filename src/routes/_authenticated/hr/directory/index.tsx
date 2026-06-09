import { createFileRoute } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, localized } from "@/i18n";
import { listDepartments } from "@/lib/api/admin.functions";
import { listStaffDirectory } from "@/lib/api/hr.functions";

export const Route = createFileRoute("/_authenticated/hr/directory/")({
  beforeLoad: () => requireModule("hr"),
  component: StaffDirectoryPage,
});

function StaffDirectoryPage() {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("all");

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff-directory", departmentId],
    queryFn: () =>
      listStaffDirectory({
        data: departmentId === "all" ? undefined : { department_id: departmentId },
      }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((raw) => {
      const row = raw as Record<string, unknown>;
      const name = `${row.full_name_ru ?? ""} ${row.full_name_kk ?? ""} ${row.email ?? ""}`.toLowerCase();
      const dept = row.departments as { name_ru?: string; name_kk?: string } | null;
      const pos = row.positions as { title_ru?: string; title_kk?: string } | null;
      const deptName = dept ? `${dept.name_ru ?? ""} ${dept.name_kk ?? ""}` : "";
      const posName = pos ? `${pos.title_ru ?? ""} ${pos.title_kk ?? ""}` : "";
      return name.includes(q) || deptName.toLowerCase().includes(q) || posName.toLowerCase().includes(q);
    });
  }, [staff, search]);

  return (
    <>
      <PageHeader title={t("hr.directory.title")} description={t("hr.directory.description")} />
      <PageBody className="max-w-5xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("hr.directory.searchPlaceholder")}
            className="sm:max-w-xs"
          />
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="sm:max-w-xs">
              <SelectValue placeholder={t("hr.directory.allDepartments")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("hr.directory.allDepartments")}</SelectItem>
              {departments.map((d) => {
                const dept = d as { id: string; name_ru: string; name_kk: string };
                return (
                  <SelectItem key={dept.id} value={dept.id}>
                    {localized(dept, locale, "name")}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("hr.directory.empty")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("hr.directory.employee")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                    {t("hr.directory.department")}
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium lg:table-cell">
                    {t("hr.directory.position")}
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium xl:table-cell">
                    {t("hr.directory.manager")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((raw) => {
                  const row = raw as Record<string, unknown>;
                  const dept = row.departments as { name_ru?: string; name_kk?: string } | null;
                  const pos = row.positions as { title_ru?: string; title_kk?: string } | null;
                  const manager = row.manager as {
                    full_name_ru?: string;
                    full_name_kk?: string;
                  } | null;
                  return (
                    <tr key={String(row.id)} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {localized(row, locale, "full_name")}
                        </div>
                        <div className="text-xs text-muted-foreground">{String(row.email ?? "")}</div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {dept ? localized(dept, locale, "name") : "—"}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        {pos ? localized(pos, locale, "title") : "—"}
                      </td>
                      <td className="hidden px-4 py-3 xl:table-cell">
                        {manager ? localized(manager, locale, "full_name") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {t("hr.directory.count").replace("{n}", String(filtered.length))}
        </p>
      </PageBody>
    </>
  );
}
