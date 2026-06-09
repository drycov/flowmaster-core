import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n, localized } from "@/i18n";
import { listMySubstitutions } from "@/lib/api/substitutions.functions";
import { fmtDateShort } from "@/lib/format";
import { SubstitutionStatusBadge } from "@/components/substitution/SubstitutionStatusBadge";
import { UserRoundCog } from "lucide-react";

export function SubstitutionsCard() {
  const { t, locale } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["my-substitutions"],
    queryFn: listMySubstitutions,
  });

  const records = data?.records ?? [];
  const actingFor = data?.actingForDetails ?? [];
  const activeCount = records.filter((r) => r.is_active).length;

  return (
    <Card className="rounded-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserRoundCog className="w-4 h-4" />
          {t("substitution.title")}
        </CardTitle>
        <Button size="sm" variant="outline" asChild>
          <Link to="/substitutions">{t("substitution.manage")}</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t("substitution.hint")}</p>

        {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}

        {!isLoading && actingFor.length > 0 && (
          <div className="rounded-sm border border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-sm space-y-1">
            <div className="font-medium text-amber-900 dark:text-amber-200">
              {t("substitution.actingTitle")}
            </div>
            {actingFor.map((row) => (
              <div key={row.id} className="text-xs">
                {row.principal ? localized(row.principal, locale, "full_name") : row.principal_id}{" "}
                <span className="text-muted-foreground">
                  ({fmtDateShort(row.valid_from, locale)} — {fmtDateShort(row.valid_until, locale)})
                </span>
              </div>
            ))}
          </div>
        )}

        {!isLoading && records.length === 0 && actingFor.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
        )}

        {!isLoading && records.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {t("substitution.myAssignments")}: {activeCount}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
