import { ExternalLink, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { linkClass, sapButtonDefaultClass } from "@/components/auth/styles/sap-tokens";
import { useI18n } from "@/i18n";
import { useTelegramAuth } from "../hooks/useTelegramAuth";

interface TelegramLoginPanelProps {
  tenantSlug?: string;
  variant?: "button" | "link";
}

export function TelegramLoginPanel({ tenantSlug, variant = "button" }: TelegramLoginPanelProps) {
  const { t } = useI18n();
  const { loading, polling, deepLink, beginLogin, cancelLogin } = useTelegramAuth(tenantSlug);

  if (polling) {
    return (
      <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("auth.telegram.waitingConfirm")}
        </div>
        {deepLink && (
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 ${linkClass}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("auth.telegram.openBot")}
          </a>
        )}
        <button type="button" className={linkClass} onClick={cancelLogin}>
          <X className="mr-1 inline h-3.5 w-3.5" />
          {t("common.cancel")}
        </button>
      </div>
    );
  }

  if (variant === "link") {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={() => void beginLogin()}
        className={`inline-flex items-center gap-1.5 disabled:opacity-50 ${linkClass}`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {t("auth.telegram.loginButton")}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={loading}
      onClick={() => void beginLogin()}
      className={sapButtonDefaultClass}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      {t("auth.telegram.loginButton")}
    </Button>
  );
}
