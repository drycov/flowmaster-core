import { Link } from "@tanstack/react-router";
import { UserRoundCog } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";

export type ActingForDetail = {
  id: string;
  principal_id: string;
  valid_from: string;
  valid_until: string;
  note: string | null;
  principal?: {
    id: string;
    full_name_ru: string;
    full_name_kk: string;
    email: string;
  } | null;
};

type SubstitutionActingBannerProps = {
  actingFor: ActingForDetail[];
};

export function SubstitutionActingBanner({ actingFor }: SubstitutionActingBannerProps) {
  const { t, locale } = useI18n();

  if (actingFor.length === 0) return null;

  return (
    <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
      <UserRoundCog className="h-4 w-4 text-amber-700 dark:text-amber-400" />
      <AlertTitle>{t("substitution.actingTitle")}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">{t("substitution.actingHint")}</p>
        <ul className="text-sm space-y-1">
          {actingFor.map((row) => (
            <li key={row.id}>
              <span className="font-medium">
                {row.principal ? localized(row.principal, locale, "full_name") : row.principal_id}
              </span>
              <span className="text-muted-foreground">
                {" "}
                — {fmtDateShort(row.valid_from, locale)} … {fmtDateShort(row.valid_until, locale)}
              </span>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="outline" asChild className="mt-1">
          <Link to="/substitutions">{t("substitution.manage")}</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
