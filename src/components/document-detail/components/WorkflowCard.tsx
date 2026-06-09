import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { useI18n, localized, workflowNodeLabel, type TFunction } from "@/i18n";
import {
  listDepartmentsBrief,
  listRolesBrief,
  listUsersBrief,
} from "@/lib/api/admin.functions";
import { listPositions } from "@/lib/api/org.functions";
import { fmtDateShort } from "@/lib/format";
import type { AssigneeLookup } from "@/lib/workflow/assignee-display";
import { resolveTaskAssigneeLabel } from "@/lib/workflow/assignee-display";
import {
  buildRouteStepsView,
  type RouteStepStatus,
  type RouteStepView,
} from "@/lib/workflow/route-steps-view";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock,
  GitFork,
  Loader2,
  XCircle,
} from "lucide-react";
import type { Task, WorkflowRun } from "../types";

interface WorkflowCardProps {
  runs: WorkflowRun[];
  tasks: Task[];
  customRoute?: unknown;
  workflowDefinition?: unknown;
  workflowName?: string | null;
}

function getRunStatusConfig(status: string, t: TFunction) {
  switch (status.toLowerCase()) {
    case "running":
      return {
        bg: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
        icon: <Clock className="mr-1 h-3 w-3 animate-pulse" />,
        label: t("doc.workflowRunning"),
      };
    case "completed":
      return {
        bg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
        label: t("doc.workflowCompleted"),
      };
    case "cancelled":
    case "failed":
      return {
        bg: "bg-destructive/10 text-destructive",
        icon: <AlertCircle className="mr-1 h-3 w-3" />,
        label: t("status.cancelled"),
      };
    default:
      return {
        bg: "bg-muted text-muted-foreground",
        icon: null,
        label: status,
      };
  }
}

function StepStatusIcon({ status }: { status: RouteStepStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
    case "in_progress":
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />;
    case "pending":
      return <Circle className="h-4 w-4 shrink-0 text-blue-500" />;
    case "rejected":
      return <XCircle className="h-4 w-4 shrink-0 text-destructive" />;
    case "cancelled":
      return <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />;
    case "escalated":
      return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />;
    default:
      return <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground/60" />;
  }
}

function StepStatusBadge({ status, t }: { status: RouteStepStatus; t: TFunction }) {
  if (status === "waiting") {
    return (
      <span className="inline-flex items-center rounded-sm border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {t("doc.routeWaiting")}
      </span>
    );
  }
  return <StatusBadge status={status} kind="status" />;
}

function RouteStepRow({
  step,
  isLast,
  locale,
  t,
  assigneeLookup,
}: {
  step: RouteStepView;
  isLast: boolean;
  locale: string;
  t: TFunction;
  assigneeLookup: AssigneeLookup;
}) {
  const typeLabel = workflowNodeLabel(t, step.nodeType);

  return (
    <div className="relative flex gap-3">
      {!isLast && (
        <div
          className={`absolute left-[7px] top-6 h-[calc(100%-4px)] w-px ${
            step.status === "completed"
              ? "bg-emerald-300 dark:bg-emerald-800"
              : "bg-border"
          }`}
        />
      )}

      <div className="relative z-[1] mt-0.5">
        <StepStatusIcon status={step.status} />
      </div>

      <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-4"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight text-foreground">
              {step.label || step.tasks[0]?.title || `${t("doc.routeStep")} ${step.order}`}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{typeLabel}</p>
            {step.assigneeLabel && (
              <p className="mt-1 text-xs text-foreground/80">
                <span className="text-muted-foreground">{t("doc.routeAssignee")}: </span>
                {step.assigneeLabel}
              </p>
            )}
          </div>
          <StepStatusBadge status={step.status} t={t} />
        </div>

        {step.tasks.length > 0 && (
          <div className="mt-2 space-y-1.5 rounded-sm border border-border/50 bg-muted/20 px-2.5 py-2">
            {step.tasks.map((task) => {
              const assigneeName = resolveTaskAssigneeLabel(
                task.assignee_id,
                locale,
                assigneeLookup,
              );
              return (
                <div key={task.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {assigneeName ?? task.title}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {task.due_at && (
                      <span className="text-muted-foreground">
                        {fmtDateShort(task.due_at, locale)}
                      </span>
                    )}
                    <StatusBadge status={task.status} kind="status" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkflowCard({
  runs,
  tasks,
  customRoute,
  workflowDefinition,
  workflowName,
}: WorkflowCardProps) {
  const { locale, t } = useI18n();

  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: () => listPositions(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["wf-users"],
    queryFn: () => listUsersBrief(),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["wf-departments"],
    queryFn: () => listDepartmentsBrief(),
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["wf-roles"],
    queryFn: () => listRolesBrief(),
  });

  const assigneeLookup = useMemo<AssigneeLookup>(
    () => ({
      positions: positions.map((p) => ({
        id: p.id,
        title_ru: p.title_ru,
        title_kk: p.title_kk,
      })),
      departments: departments.map((d) => ({
        id: d.id,
        name_ru: d.name_ru,
        name_kk: d.name_kk,
        code: d.code,
      })),
      users: users.map((u) => ({
        id: u.id,
        full_name_ru: u.full_name_ru,
        full_name_kk: u.full_name_kk,
        position_id: u.position_id,
      })),
      roles,
    }),
    [positions, departments, users, roles],
  );

  const activeRun =
    runs.find((r) => r.status === "running") ?? runs[0] ?? null;

  const resolvedWorkflowDef =
    workflowDefinition ??
    activeRun?.workflows?.definition ??
    (activeRun as { context?: unknown })?.context;

  const { steps, runStatus } = buildRouteStepsView({
    locale,
    customRoute,
    workflowDefinition: resolvedWorkflowDef,
    assigneeLookup,
    t,
    runs,
    tasks,
  });

  const routeTitle =
    workflowName ??
    (activeRun?.workflows ? localized(activeRun.workflows, locale, "name") : null) ??
    (customRoute ? t("doc.customRoute") : null);

  const hasRoute = steps.length > 0 || runs.length > 0 || !!customRoute || !!workflowDefinition;

  return (
    <Card className="rounded-sm shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <GitFork className="h-4 w-4 text-primary" />
          {t("doc.workflow")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasRoute ? (
          <div className="py-2 text-center text-sm italic text-muted-foreground">
            {t("common.empty")}
          </div>
        ) : (
          <div className="space-y-3">
            {(routeTitle || runStatus) && (
              <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-3">
                {routeTitle && (
                  <span className="text-sm font-medium text-foreground">{routeTitle}</span>
                )}
                {runStatus && (() => {
                  const cfg = getRunStatusConfig(runStatus, t);
                  return (
                    <span
                      className={`inline-flex shrink-0 items-center rounded-sm px-2 py-0.5 text-[10px] font-medium ${cfg.bg}`}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>
            )}

            {steps.length > 0 ? (
              <div className="pt-1">
                {steps.map((step, index) => (
                  <RouteStepRow
                    key={step.id}
                    step={step}
                    isLast={index === steps.length - 1}
                    locale={locale}
                    t={t}
                    assigneeLookup={assigneeLookup}
                  />
                ))}
              </div>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("doc.routeNotStarted")}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("doc.routeNoSteps")}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
