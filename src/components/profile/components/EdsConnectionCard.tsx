import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LockKeyhole, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { useI18n } from "@/i18n";
import { useEdsLink } from "../hooks/useEdsLink";
import type { UserProfile } from "../types";

interface EdsConnectionCardProps {
  profile: UserProfile;
  isOwnProfile: boolean;
  onUpdated?: () => void;
}

export function EdsConnectionCard({ profile, isOwnProfile, onUpdated }: EdsConnectionCardProps) {
  const { t } = useI18n();
  const { loading, linkEds } = useEdsLink(onUpdated);

  const connected = profile.has_eds;

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {connected ? (
            <ShieldCheck className="h-5 w-5 mt-0.5 text-emerald-600" />
          ) : (
            <ShieldOff className="h-5 w-5 mt-0.5 text-muted-foreground" />
          )}
          <div className="space-y-1">
            <h3 className="font-medium">{t("profile.edsSection")}</h3>
            <p className="text-sm text-muted-foreground">
              {connected ? t("profile.edsConnected") : t("profile.edsNotConnected")}
            </p>
            {!connected && isOwnProfile && (
              <p className="text-sm text-muted-foreground">{t("profile.edsConnectHint")}</p>
            )}
          </div>
        </div>
        <Badge variant={connected ? "default" : "outline"}>
          {connected ? t("profile.edsStatusOn") : t("profile.edsStatusOff")}
        </Badge>
      </div>

      {profile.iin && (
        <div className="text-sm">
          <span className="text-muted-foreground">{t("profile.linkedIin")}: </span>
          <span className="font-mono">{profile.iin}</span>
        </div>
      )}

      {!connected && isOwnProfile && (
        <Button onClick={() => void linkEds()} disabled={loading} variant="outline" size="sm">
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <LockKeyhole className="w-4 h-4 mr-2" />
          )}
          {t("profile.linkEdsAction")}
        </Button>
      )}
    </div>
  );
}
