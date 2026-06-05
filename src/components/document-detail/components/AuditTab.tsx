import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import type { WorkflowEvent } from "../types";

interface AuditTabProps {
  events: WorkflowEvent[];
}

export function AuditTab({ events }: AuditTabProps) {
  const { locale, t } = useI18n();

  return (
    <Card className="rounded-sm">
      <CardContent className="p-0">
        <table className="w-full data-table">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2 w-40">{t("common.date")}</th>
              <th className="text-left px-4 py-2">Событие</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                  {t("common.empty")}
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                    {fmtDate(e.created_at, locale)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {e.event_type}
                    <span className="text-xs text-muted-foreground ml-2">· {e.node_id ?? ""}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}