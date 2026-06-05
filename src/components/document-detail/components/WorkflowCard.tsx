import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n, localized } from "@/lib/i18n";
import type { WorkflowRun } from "../types";

interface WorkflowCardProps {
  runs: WorkflowRun[];
}

export function WorkflowCard({ runs }: WorkflowCardProps) {
  const { locale, t } = useI18n();

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t("doc.workflow")}</CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("common.empty")}</div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <div key={r.id} className="border border-border rounded-sm p-2">
                <div className="text-xs font-mono text-muted-foreground">{r.status}</div>
                <div className="text-sm">
                  {r.workflows ? localized(r.workflows, locale, "name") : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  Текущий узел: {r.current_node ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}