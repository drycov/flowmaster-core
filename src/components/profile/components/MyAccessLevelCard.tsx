import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { useI18n, localized } from "@/i18n";
import { listAccessLevelsBrief } from "@/lib/api/references.functions";

interface Props {
  accessLevelId?: string | null;
}

export function MyAccessLevelCard({ accessLevelId }: Props) {
  const { t, locale } = useI18n();

  const { data: levels = [] } = useQuery({
    queryKey: ["ref-access-levels-brief"],
    queryFn: listAccessLevelsBrief,
  });

  const level = accessLevelId ? levels.find((l) => l.id === accessLevelId) : null;

  return (
    <Card className="rounded-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4" />
          {t("access.myClearance")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">{t("access.myClearanceHint")}</p>
        {level ? (
          <Badge variant="secondary" className="font-normal">
            {localized(level, locale, "name")} ({level.code})
          </Badge>
        ) : (
          <p className="text-sm text-muted-foreground">{t("access.noClearance")}</p>
        )}
      </CardContent>
    </Card>
  );
}
