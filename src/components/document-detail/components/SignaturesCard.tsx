import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import type { Signature } from "../types";

interface SignaturesCardProps {
  signatures: Signature[];
}

export function SignaturesCard({ signatures }: SignaturesCardProps) {
  const { locale, t } = useI18n();

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t("doc.signatures")}</CardTitle>
      </CardHeader>
      <CardContent>
        {signatures.length === 0 ? (
          <div className="text-sm text-muted-foreground">Подписей нет</div>
        ) : (
          <div className="space-y-2">
            {signatures.map((s) => (
              <div key={s.id} className="border border-border rounded-sm p-2 text-xs">
                <div className="font-mono">{s.signature_type}</div>
                <div className="text-muted-foreground">{s.cert_subject || "—"}</div>
                <div className="text-muted-foreground">
                  {s.signed_at ? fmtDate(s.signed_at, locale) : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}