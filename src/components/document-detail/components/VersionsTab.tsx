import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import type { DocumentVersion } from "../types";

interface VersionsTabProps {
  versions: DocumentVersion[];
}

export function VersionsTab({ versions }: VersionsTabProps) {
  const { locale, t } = useI18n();

  return (
    <Card className="rounded-sm">
      <CardContent className="p-0">
        <table className="w-full data-table">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2 w-20">#</th>
              <th className="text-left px-4 py-2">{t("common.comment")}</th>
              <th className="text-left px-4 py-2 w-40">{t("common.date")}</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  {t("common.empty")}
                </td>
              </tr>
            ) : (
              versions.map((v) => (
                <tr key={v.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono">v{v.version_no}</td>
                  <td className="px-4 py-2">{v.comment || "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {fmtDate(v.created_at, locale)}
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