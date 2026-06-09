import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  Shield,
  UserRound,
} from "lucide-react";
import { fmtDateShort } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n, localized } from "@/i18n";
import { canAccessModule } from "@/lib/access/evaluate";
import { getMyProfile } from "@/lib/api/admin.functions";
import { getMyHrSummary } from "@/lib/api/hr.functions";
import { getLicenseStatus } from "@/lib/api/license.functions";

export function ProfileHrCard() {
  const { t, locale } = useI18n();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMyProfile });
  const { data: license } = useQuery({ queryKey: ["license"], queryFn: getLicenseStatus });

  const canHr =
    !!me &&
    !!license &&
    canAccessModule(
      {
        roles: me.roles,
        permissions: me.permissions,
      },
      license,
      "hr",
      "read",
    );

  const { data, isLoading } = useQuery({
    queryKey: ["my-hr-summary"],
    queryFn: getMyHrSummary,
    enabled: !!canHr,
  });

  if (!canHr || isLoading || !data) return null;

  const managerName = data.manager
    ? localized(data.manager, locale, "full_name") || data.manager.email
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          {t("profile.hr.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t("hr.leave.remaining")}: </span>
            <span className="font-semibold text-primary">{data.balance.remaining_days}</span>
            <span className="text-muted-foreground"> / {data.balance.entitled_days}</span>
          </div>
          {managerName ? (
            <div className="flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{t("profile.hr.manager")}: </span>
              <span>{managerName}</span>
            </div>
          ) : null}
        </div>
        {(data.next_leave || data.next_duty) && (
          <div className="space-y-1.5 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            {data.next_leave ? (
              <div>
                <span className="text-muted-foreground">{t("profile.hr.nextLeave")}: </span>
                <span className="font-medium">
                  {localized(
                    (
                      data.next_leave as {
                        ref_absence_types?: { name_ru: string; name_kk: string };
                      }
                    ).ref_absence_types ?? { name_ru: "—", name_kk: "—" },
                    locale,
                    "name",
                  )}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {fmtDateShort(String((data.next_leave as { date_from: string }).date_from))}
                  {(data.next_leave as { date_from: string; date_to: string }).date_from !==
                  (data.next_leave as { date_to: string }).date_to
                    ? ` — ${fmtDateShort(String((data.next_leave as { date_to: string }).date_to))}`
                    : ""}
                </span>
              </div>
            ) : null}
            {data.next_duty ? (
              <div>
                <span className="text-muted-foreground">{t("profile.hr.nextDuty")}: </span>
                <span className="font-medium">
                  {localized(
                    (data.next_duty as { ref_duty_roles?: { name_ru: string; name_kk: string } })
                      .ref_duty_roles ?? { name_ru: "—", name_kk: "—" },
                    locale,
                    "name",
                  )}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  ·{" "}
                  {fmtDateShort(
                    String((data.next_duty as { starts_at: string }).starts_at).slice(0, 10),
                  )}
                </span>
              </div>
            ) : null}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/hr/leave">
              {t("profile.hr.openLeave")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/hr/leave/schedule">
              <CalendarRange className="mr-1 h-4 w-4" />
              {t("profile.hr.openLeaveSchedule")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/hr/duty">
              <Shield className="mr-1 h-4 w-4" />
              {t("profile.hr.openDuty")}
            </Link>
          </Button>
          {data.pending_approvals > 0 ? (
            <Button variant="secondary" size="sm" asChild>
              <Link to="/hr/leave/approvals">
                <ClipboardList className="mr-1 h-4 w-4" />
                {t("hr.leave.approvalsLink")} ({data.pending_approvals})
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
