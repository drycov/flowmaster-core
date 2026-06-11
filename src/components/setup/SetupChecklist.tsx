import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getSystemInitStatus } from "@/lib/api/system.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Settings } from "lucide-react";
import { useI18n, interpolate } from "@/i18n";

function Step({
  done,
  label,
  to,
  configureLabel,
}: {
  done: boolean;
  label: string;
  to: string;
  configureLabel: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-sm">
        {done ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <span className={done ? "text-muted-foreground" : ""}>{label}</span>
      </div>
      {!done && (
        <Button variant="outline" size="sm" asChild>
          <Link to={to}>{configureLabel}</Link>
        </Button>
      )}
    </li>
  );
}

export function SetupChecklist({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const { data } = useQuery({
    queryKey: ["system-init"],
    queryFn: () => getSystemInitStatus(),
    enabled: isAdmin,
  });

  if (!isAdmin || !data?.setup_checklist_incomplete) return null;

  return (
    <Card className="rounded-sm border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings className="w-4 h-4" />
          {t("setup.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{t("setup.description")}</p>
        <ul>
          <Step
            done={data.has_admin}
            label={t("setup.step.admin")}
            to="/admin/users"
            configureLabel={t("setup.configure")}
          />
          <Step
            done={data.organization_configured}
            label={t("setup.step.organization")}
            to="/admin/organization"
            configureLabel={t("setup.configure")}
          />
          <Step
            done={data.departments_count > 0}
            label={t("setup.step.departments")}
            to="/admin/departments"
            configureLabel={t("setup.configure")}
          />
          <Step
            done={data.published_workflows > 0}
            label={t("setup.step.workflow")}
            to="/workflows"
            configureLabel={t("setup.configure")}
          />
          <Step
            done={data.published_templates > 0}
            label={interpolate(t("setup.step.templates"), { name: t("nav.templates") })}
            to="/templates"
            configureLabel={t("setup.configure")}
          />
        </ul>
      </CardContent>
    </Card>
  );
}
