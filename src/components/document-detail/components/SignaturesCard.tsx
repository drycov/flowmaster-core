import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import { ShieldCheck } from "lucide-react"; // Добавим иконку для визуального подтверждения валидности подписи
import type { Signature } from "../types";

interface SignaturesCardProps {
  signatures: Signature[];
}

// Хелпер для извлечения понятного имени (Common Name) из строки cert_subject ЭЦП НУЦ РК
function parseCertSubject(subject?: string): string {
  if (!subject) return "—";
  
  // Ищем CN=... в строке субъекта сертификата
  const match = subject.match(/CN=([^,]+)/);
  return match ? match[1].trim() : subject;
}

export function SignaturesCard({ signatures }: SignaturesCardProps) {
  const { locale, t } = useI18n();

  return (
    <Card className="rounded-sm shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          {t("doc.signatures")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {signatures.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2 italic text-center">
            {t("common.empty") || "Подписей нет"}
          </div>
        ) : (
          <div className="space-y-2">
            {signatures.map((s) => {
              const displayName = parseCertSubject(s.cert_subject);
              
              return (
                <div 
                  key={s.id} 
                  className="border border-border rounded-sm p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-medium text-sm text-foreground break-words max-w-[70%]">
                      {displayName}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                      {s.signature_type}
                    </span>
                  </div>
                  
                  {/* Если CN распарсился удачно, а в cert_subject был полный текст, можно спрятать его под мелкий шрифт */}
                  {s.cert_subject && s.cert_subject.includes("CN=") && (
                    <div className="text-[11px] text-muted-foreground font-mono truncate mb-1" title={s.cert_subject}>
                      {s.cert_subject}
                    </div>
                  )}

                  <div className="text-[11px] text-muted-foreground flex justify-between items-center mt-2 pt-1.5 border-t border-border/40">
                    <span>Статус подписи:</span>
                    <span className="font-medium">
                      {s.signed_at ? fmtDate(s.signed_at, locale) : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}