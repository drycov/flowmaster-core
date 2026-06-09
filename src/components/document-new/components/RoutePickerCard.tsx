import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { listWorkflows, getWorkflow } from "@/lib/api/workflows.functions";
import { listUsersBrief, listDepartmentsBrief, listRolesBrief } from "@/lib/api/admin.functions";
import { listPositions } from "@/lib/api/org.functions";
import {
  buildModifiedDefinition,
  extractActionableNodes,
  type ModifyNodeOverride,
} from "@/lib/workflow/route-builder";
import type { WorkflowDefinition } from "@/components/workflow-designer/types";

export type RouteStep = {
  order: number;
  label?: string;
  assignee_mode: "user" | "position" | "department_head" | "role";
  assignee_user_id?: string | null;
  assignee_position_id?: string | null;
  assignee_department_id?: string | null;
  assignee_role?: string | null;
  sla_hours: number;
  action: "approve" | "sign" | "review";
};

export type RouteValue =
  | { kind: "template_default" }
  | { kind: "workflow"; workflow_id: string }
  | { kind: "modify"; workflow_id: string; overrides: ModifyNodeOverride[] }
  | { kind: "custom"; steps: RouteStep[] }
  | { kind: "none" };

interface Props {
  templateDefaultWorkflowId?: string | null;
  templateAllowCustom?: boolean;
  value: RouteValue;
  onChange: (v: RouteValue) => void;
}

function SortableStep({
  id,
  step,
  idx,
  onUpdate,
  onRemove,
  users,
  positions,
  departments,
  roles,
}: {
  id: string;
  step: RouteStep;
  idx: number;
  onUpdate: (patch: Partial<RouteStep>) => void;
  onRemove: () => void;
  users: any[];
  positions: any[];
  departments: any[];
  roles: any[];
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-sm p-3 space-y-2 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Badge variant="secondary">
            {t("doc.routeStep")} {idx + 1}
          </Badge>
        </div>
        <Button size="icon" variant="ghost" onClick={onRemove} type="button">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">{t("common.type")}</Label>
          <Select
            value={step.assignee_mode}
            onValueChange={(v) => onUpdate({ assignee_mode: v as RouteStep["assignee_mode"] })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">{t("audit.entity.user")}</SelectItem>
              <SelectItem value="position">{t("audit.entity.position")}</SelectItem>
              <SelectItem value="department_head">{t("wf.assignee.deptHead")}</SelectItem>
              <SelectItem value="role">{t("wf.assignee.role")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t("common.actions")}</Label>
          <Select
            value={step.action}
            onValueChange={(v) => onUpdate({ action: v as RouteStep["action"] })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approve">{t("doc.routeApproval")}</SelectItem>
              <SelectItem value="sign">{t("doc.routeSigning")}</SelectItem>
              <SelectItem value="review">{t("task.action.review")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {step.assignee_mode === "user" && (
        <Select
          value={step.assignee_user_id ?? ""}
          onValueChange={(v) => onUpdate({ assignee_user_id: v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder={t("audit.entity.user")} />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name_ru || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {step.assignee_mode === "position" && (
        <Select
          value={step.assignee_position_id ?? ""}
          onValueChange={(v) => onUpdate({ assignee_position_id: v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder={t("audit.entity.position")} />
          </SelectTrigger>
          <SelectContent>
            {positions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title_ru}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {step.assignee_mode === "department_head" && (
        <Select
          value={step.assignee_department_id ?? ""}
          onValueChange={(v) => onUpdate({ assignee_department_id: v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder={t("audit.entity.department")} />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name_ru} ({d.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {step.assignee_mode === "role" && (
        <Select
          value={step.assignee_role ?? ""}
          onValueChange={(v) => onUpdate({ assignee_role: v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder={t("wf.assignee.role")} />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.role} value={r.role}>
                {r.title_ru || r.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">{t("wf.sla.hours")}</Label>
          <Input
            type="number"
            className="h-8"
            value={step.sla_hours}
            onChange={(e) => onUpdate({ sla_hours: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label className="text-xs">{t("wf.edgeLabel")}</Label>
          <Input
            className="h-8"
            value={step.label ?? ""}
            onChange={(e) => onUpdate({ label: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export function RoutePickerCard({
  templateDefaultWorkflowId,
  templateAllowCustom = true,
  value,
  onChange,
}: Props) {
  const { t } = useI18n();
  const { data: workflows = [] } = useQuery({
    queryKey: ["wfs"],
    queryFn: () => listWorkflows(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["wf-users"],
    queryFn: () => listUsersBrief(),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["wf-departments"],
    queryFn: () => listDepartmentsBrief(),
  });
  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: () => listPositions(),
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["wf-roles"],
    queryFn: () => listRolesBrief(),
  });

  const modifyWorkflowId =
    value.kind === "modify" ? value.workflow_id : (templateDefaultWorkflowId ?? null);

  const { data: baseWorkflow } = useQuery({
    queryKey: ["wf-modify", modifyWorkflowId],
    queryFn: () => getWorkflow({ data: { id: modifyWorkflowId! } }),
    enabled: !!modifyWorkflowId && value.kind === "modify",
  });

  const [kind, setKind] = useState<RouteValue["kind"]>(value.kind);

  useEffect(() => {
    setKind(value.kind);
  }, [value.kind]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleKindChange = (k: RouteValue["kind"]) => {
    setKind(k);
    if (k === "none") onChange({ kind: "none" });
    else if (k === "template_default") onChange({ kind: "template_default" });
    else if (k === "workflow")
      onChange({ kind: "workflow", workflow_id: (workflows as any[])[0]?.id ?? "" });
    else if (k === "modify")
      onChange({
        kind: "modify",
        workflow_id: templateDefaultWorkflowId ?? (workflows as any[])[0]?.id ?? "",
        overrides: [],
      });
    else if (k === "custom") onChange({ kind: "custom", steps: [] });
  };

  const initModifyOverrides = (def: WorkflowDefinition): ModifyNodeOverride[] =>
    extractActionableNodes(def).map((n) => ({
      id: n.id,
      enabled: (n.config as { is_required?: boolean })?.is_required !== false,
      label: n.label,
      assignee_mode: n.assignee_mode ?? n.assignee_type,
      assignee_ref: n.assignee_ref ?? n.assignee_id ?? null,
      sla_hours: n.sla_hours,
    }));

  useEffect(() => {
    if (value.kind === "modify" && baseWorkflow && value.overrides.length === 0) {
      const def = (baseWorkflow as unknown as { definition: WorkflowDefinition }).definition;
      onChange({
        kind: "modify",
        workflow_id: value.workflow_id,
        overrides: initModifyOverrides(def),
      });
    }
  }, [value.kind, baseWorkflow]);

  const steps = value.kind === "custom" ? value.steps : [];
  const stepIds = steps.map((_, i) => `step-${i}`);

  const updateSteps = (next: RouteStep[]) => {
    onChange({ kind: "custom", steps: next.map((s, i) => ({ ...s, order: i })) });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stepIds.indexOf(String(active.id));
    const newIndex = stepIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    updateSteps(arrayMove(steps, oldIndex, newIndex));
  };

  const updateOverride = (id: string, patch: Partial<ModifyNodeOverride>) => {
    if (value.kind !== "modify") return;
    onChange({
      ...value,
      overrides: value.overrides.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  };

  const modifyDef =
    value.kind === "modify" && baseWorkflow
      ? buildModifiedDefinition(
          (baseWorkflow as unknown as { definition: WorkflowDefinition }).definition,
          value.overrides,
        )
      : null;

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t("doc.routeTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>{t("common.type")}</Label>
          <Select value={kind} onValueChange={(v) => handleKindChange(v as RouteValue["kind"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("tpl.noWorkflow")}</SelectItem>
              {templateDefaultWorkflowId && (
                <SelectItem value="template_default">{t("doc.from_template")}</SelectItem>
              )}
              {templateDefaultWorkflowId && templateAllowCustom && (
                <SelectItem value="modify">{t("common.edit")}</SelectItem>
              )}
              <SelectItem value="workflow">{t("doc.selectRoute")}</SelectItem>
              {templateAllowCustom && (
                <SelectItem value="custom">{t("tpl.allowCustomRoute")}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {value.kind === "workflow" && (
          <div>
            <Label>{t("audit.entity.workflow")}</Label>
            <Select
              value={value.workflow_id}
              onValueChange={(v) => onChange({ kind: "workflow", workflow_id: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(workflows as any[]).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name_ru}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {value.kind === "modify" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("doc.routeWillBeUsed")}</p>
            {!baseWorkflow ? (
              <p className="text-sm text-muted-foreground">{t("tpl.loading")}</p>
            ) : value.overrides.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : (
              value.overrides.map((o) => (
                <div key={o.id} className="border rounded-sm p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={o.enabled}
                        onCheckedChange={(c) => updateOverride(o.id, { enabled: c })}
                      />
                      <span className="text-sm font-medium">{o.label || o.id}</span>
                    </div>
                    <Badge variant={o.enabled ? "secondary" : "outline"}>
                      {o.enabled ? t("doc.enabled") : t("doc.disabled")}
                    </Badge>
                  </div>
                  {o.enabled && (
                    <>
                      <Input
                        className="h-8"
                        placeholder={t("wf.edgeLabel")}
                        value={o.label ?? ""}
                        onChange={(e) => updateOverride(o.id, { label: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={o.assignee_mode ?? "user"}
                          onValueChange={(v) => updateOverride(o.id, { assignee_mode: v })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">{t("audit.entity.user")}</SelectItem>
                            <SelectItem value="position">{t("audit.entity.position")}</SelectItem>
                            <SelectItem value="department_head">
                              {t("wf.assignee.deptHead")}
                            </SelectItem>
                            <SelectItem value="role">{t("wf.assignee.role")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          className="h-8"
                          placeholder={t("wf.sla.hours")}
                          value={o.sla_hours ?? ""}
                          onChange={(e) =>
                            updateOverride(o.id, { sla_hours: Number(e.target.value) || undefined })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
            {modifyDef && (
              <p className="text-xs text-muted-foreground">
                {t("wf.nodesCount")}{" "}
                {
                  modifyDef.nodes.filter((n) => ["APPROVAL", "SIGNATURE", "TASK"].includes(n.type))
                    .length
                }
                , {t("wf.edgesCount")} {modifyDef.edges.length}
              </p>
            )}
          </div>
        )}

        {value.kind === "custom" && (
          <div className="space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
                {steps.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
                )}
                {steps.map((step, idx) => (
                  <SortableStep
                    key={stepIds[idx]}
                    id={stepIds[idx]}
                    step={step}
                    idx={idx}
                    users={users as any[]}
                    positions={positions as any[]}
                    departments={departments as any[]}
                    roles={roles as any[]}
                    onUpdate={(patch) => {
                      const next = [...steps];
                      next[idx] = { ...next[idx], ...patch };
                      updateSteps(next);
                    }}
                    onRemove={() => updateSteps(steps.filter((_, i) => i !== idx))}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() =>
                updateSteps([
                  ...steps,
                  { order: steps.length, assignee_mode: "user", sla_hours: 72, action: "approve" },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> {t("doc.addStep")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
