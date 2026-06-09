import { localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";

type DutyRow = Record<string, unknown>;

export function DutyDayList({
  duties,
  locale,
  showDepartment = true,
}: {
  duties: DutyRow[];
  locale: "ru" | "kk";
  showDepartment?: boolean;
}) {
  if (!duties.length) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {duties.map((d) => {
        const role = d.ref_duty_roles as { name_ru: string; name_kk: string; color?: string } | null;
        const assignee = d.assignee as { full_name_ru?: string; full_name_kk?: string } | null;
        const dept = d.departments as { code?: string; name_ru?: string; name_kk?: string } | null;
        const deptLabel = dept ? (dept.code ?? localized(dept, locale, "name")) : null;
        const roleLabel = role ? localized(role, locale, "name") : "—";
        const assigneeLabel = assignee ? localized(assignee, locale, "full_name") : "";
        return (
          <li
            key={String(d.id)}
            className="truncate rounded px-1 py-0.5 text-[10px] leading-tight text-white"
            style={{ backgroundColor: role?.color ?? "#6366f1" }}
            title={[deptLabel, roleLabel, assigneeLabel].filter(Boolean).join(" · ")}
          >
            {showDepartment && deptLabel ? `[${deptLabel}] ` : ""}
            {roleLabel}
          </li>
        );
      })}
    </ul>
  );
}
