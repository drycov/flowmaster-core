import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, SlaBadge } from "@/components/StatusBadge";
import { useI18n } from "@/lib/i18n";
import { fmtDateShort } from "@/lib/format";
import { Field } from "./Field";
import type { Document } from "../types";

interface MetadataCardProps {
  document: Document;
}

export function MetadataCard({ document }: MetadataCardProps) {
  const { locale, t } = useI18n();

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t("doc.metadata")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Field label={t("common.status")}>
          <StatusBadge status={document.status} />
        </Field>
        
        <Field label="SLA">
          {document.sla_status ? (
            <SlaBadge sla={document.sla_status} />
          ) : (
            <span className="text-xs text-muted-foreground">Не указано</span>
          )}
        </Field>
        
        <Field label={t("common.type")}>
          {document.doc_type || "—"}
        </Field>
        
        <Field label={t("common.deadline")}>
          {document.due_at ? fmtDateShort(document.due_at, locale) : "—"}
        </Field>
        
        <Field label={t("common.version")}>
          v{document.current_version}
        </Field>
      </CardContent>
    </Card>
  );
}