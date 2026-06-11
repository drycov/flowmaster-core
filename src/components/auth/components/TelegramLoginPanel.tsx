import { ExternalLink, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useTelegramAuth } from "../hooks/useTelegramAuth";

interface TelegramLoginPanelProps {
  tenantSlug?: string;
}

export function TelegramLoginPanel({ tenantSlug }: TelegramLoginPanelProps) {
  const { t } = useI18n();
  const { loading, polling, deepLink, beginLogin, cancelLogin } = useTelegramAuth(tenantSlug);

  if (polling) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("auth.telegram.waitingConfirm")}
        </div>
        <p className="text-xs text-muted-foreground">{t("auth.telegram.waitingHint")}</p>
        {deepLink && (
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={deepLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("auth.telegram.openBot")}
            </a>
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={cancelLogin}>
          <X className="mr-2 h-4 w-4" />
          {t("common.cancel")}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 w-full rounded border border-[#BCC3CA] bg-white text-sm font-semibold text-[#0064D9] shadow-none hover:border-[#0070F2] hover:bg-[#EBF8FF]"
      disabled={loading}
      onClick={() => void beginLogin()}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Send className="mr-2 h-4 w-4" />
      )}
      {t("auth.telegram.loginButton")}
    </Button>
  );
}
