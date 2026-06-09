import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";

type DutyRow = Record<string, unknown>;

export function DutyAssignmentsList({
  duties,
  isLoading,
  canManage,
  onCancel,
  cancellingId,
}: {
  duties: DutyRow[];
  isLoading: boolean;
  canManage: boolean;
  onCancel?: (id: string) => void;
  cancellingId?: string | null;
}) {
  const { t, locale } = useI18n();

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!duties.length) {
    return <p className="text-sm text-muted-foreground">{t("scheduling.duty.listEmpty")}</p>;
  }

  const sorted = [...duties].sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));

  return (
    <ul className="divide-y">
      {sorted.map((raw) => {
        const d = raw as DutyRow & {
          id: string;
          starts_at: string;
          ends_at: string;
          status: string;
          note?: string;
          ref_duty_roles?: { name_ru: string; name_kk: string } | null;
          assignee?: { full_name_ru?: string; full_name_kk?: string } | null;
          substitute?: { full_name_ru?: string; full_name_kk?: string } | null;
          departments?: { code?: string; name_ru?: string; name_kk?: string } | null;
        };
        const role = d.ref_duty_roles;
        const assignee = d.assignee;
        const substitute = d.substitute;
        const dept = d.departments;
        const start = String(d.starts_at).slice(0, 10);
        const end = String(d.ends_at).slice(0, 10);
        const cancelled = d.status === "cancelled";

        return (
          <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
            <div className={cancelled ? "opacity-60" : undefined}>
              <div className="font-medium">
                {role ? localized(role, locale, "name") : "—"}
                {assignee ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {localized(assignee, locale, "full_name")}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {fmtDateShort(start)}
                {start !== end ? ` — ${fmtDateShort(end)}` : ""}
                {dept ? <span> · {dept.code ?? localized(dept, locale, "name")}</span> : null}
              </div>
              {substitute ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("scheduling.duty.substituteLabel")}:{" "}
                  {localized(substitute, locale, "full_name")}
                </p>
              ) : null}
              {d.note ? (
                <p className="mt-1 text-xs text-muted-foreground">{String(d.note)}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={cancelled ? "outline" : "secondary"}>{d.status}</Badge>
              {canManage && !cancelled && onCancel ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  disabled={cancellingId === d.id}
                  onClick={() => onCancel(d.id)}
                  title={t("scheduling.duty.cancel")}
                >
                  {cancellingId === d.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
