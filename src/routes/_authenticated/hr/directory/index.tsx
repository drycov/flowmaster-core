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
import { HrEmptyState } from "@/components/hr/HrEmptyState";
import { HrSubNav } from "@/components/hr/HrSubNav";
import { useI18n, localized } from "@/i18n";
import { listDepartments } from "@/lib/api/admin.functions";
import { listStaffDirectory, type StaffDirectoryRow } from "@/lib/api/hr.functions";

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
    return staff.filter((row) => {
      const name =
        `${row.full_name_ru ?? ""} ${row.full_name_kk ?? ""} ${row.email ?? ""}`.toLowerCase();
      const deptName = row.departments
        ? `${row.departments.name_ru ?? ""} ${row.departments.name_kk ?? ""}`
        : "";
      const posName = row.positions
        ? `${row.positions.title_ru ?? ""} ${row.positions.title_kk ?? ""}`
        : "";
      return (
        name.includes(q) || deptName.toLowerCase().includes(q) || posName.toLowerCase().includes(q)
      );
    });
  }, [staff, search]);

  return (
    <>
      <PageHeader title={t("hr.directory.title")} description={t("hr.directory.description")} />
      <PageBody className="max-w-5xl space-y-4">
        <HrSubNav />
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
          <HrEmptyState title={t("hr.directory.empty")} />
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
                {filtered.map((row: StaffDirectoryRow) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{localized(row, locale, "full_name")}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {row.departments ? localized(row.departments, locale, "name") : "—"}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {row.positions ? localized(row.positions, locale, "title") : "—"}
                    </td>
                    <td className="hidden px-4 py-3 xl:table-cell">
                      {row.manager ? localized(row.manager, locale, "full_name") : "—"}
                    </td>
                  </tr>
                ))}
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
