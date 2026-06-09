import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { QrCode } from "lucide-react";

interface DocumentQrCardProps {
  documentId: string;
  regNumber: string;
}

export function DocumentQrCard({ documentId, regNumber }: DocumentQrCardProps) {
  const { t } = useI18n();
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/documents/${documentId}`
      : `/documents/${documentId}`;

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`;

  return (
    <Card className="rounded-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <QrCode className="w-4 h-4" />
          {t("doc.qrCode")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2 text-center">
        <img
          src={qrSrc}
          alt={t("doc.qrCode")}
          width={160}
          height={160}
          className="rounded-sm border"
        />
        <p className="text-xs text-muted-foreground font-mono">{regNumber}</p>
        <p className="text-[10px] text-muted-foreground break-all max-w-full">{url}</p>
      </CardContent>
    </Card>
  );
}
