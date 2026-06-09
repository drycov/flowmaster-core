import { localized } from "@/i18n";

type LeaveRow = Record<string, unknown>;

export function LeaveDayList({
  leaves,
  locale,
  showEmployee = false,
}: {
  leaves: LeaveRow[];
  locale: "ru" | "kk";
  showEmployee?: boolean;
}) {
  if (!leaves.length) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {leaves.map((d) => {
        const type = d.ref_absence_types as {
          name_ru: string;
          name_kk: string;
          color?: string;
        } | null;
        const employee = d.employee as {
          full_name_ru?: string;
          full_name_kk?: string;
        } | null;
        const typeLabel = type ? localized(type, locale, "name") : "—";
        const employeeLabel = employee ? localized(employee, locale, "full_name") : "";
        const status = String(d.status ?? "");
        const isPending = status === "pending";
        return (
          <li
            key={String(d.id)}
            className="truncate rounded px-1 py-0.5 text-[10px] leading-tight text-white"
            style={{
              backgroundColor: type?.color ?? "#22c55e",
              opacity: isPending ? 0.75 : 1,
            }}
            title={[showEmployee ? employeeLabel : null, typeLabel, status]
              .filter(Boolean)
              .join(" · ")}
          >
            {showEmployee && employeeLabel ? `${employeeLabel}: ` : ""}
            {typeLabel}
          </li>
        );
      })}
    </ul>
  );
}
