import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { listWorkflows } from "@/lib/api/workflows.functions";
import {
  listUsersBrief,
  listDepartmentsBrief,
  listRolesBrief,
} from "@/lib/api/admin.functions";
import { listPositions } from "@/lib/api/org.functions";

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
  | { kind: "custom"; steps: RouteStep[] }
  | { kind: "none" };

interface Props {
  templateDefaultWorkflowId?: string | null;
  templateAllowCustom?: boolean;
  value: RouteValue;
  onChange: (v: RouteValue) => void;
}

export function RoutePickerCard({
  templateDefaultWorkflowId,
  templateAllowCustom = true,
  value,
  onChange,
}: Props) {
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

  const [kind, setKind] = useState<RouteValue["kind"]>(value.kind);

  const handleKindChange = (k: RouteValue["kind"]) => {
    setKind(k);
    if (k === "none") onChange({ kind: "none" });
    else if (k === "template_default") onChange({ kind: "template_default" });
    else if (k === "workflow")
      onChange({ kind: "workflow", workflow_id: (workflows as any[])[0]?.id ?? "" });
    else if (k === "custom") onChange({ kind: "custom", steps: [] });
  };

  const steps = value.kind === "custom" ? value.steps : [];

  const updateSteps = (next: RouteStep[]) => {
    onChange({ kind: "custom", steps: next.map((s, i) => ({ ...s, order: i })) });
  };

  const addStep = () => {
    updateSteps([
      ...steps,
      {
        order: steps.length,
        assignee_mode: "user",
        sla_hours: 72,
        action: "approve",
      },
    ]);
  };

  const updateStep = (idx: number, patch: Partial<RouteStep>) => {
    const next = [...steps];
    next[idx] = { ...next[idx], ...patch };
    updateSteps(next);
  };

  const removeStep = (idx: number) => updateSteps(steps.filter((_, i) => i !== idx));
  const moveStep = (idx: number, dir: -1 | 1) => {
    const next = [...steps];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    updateSteps(next);
  };

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm">Маршрут согласования</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Источник маршрута</Label>
          <Select value={kind} onValueChange={(v) => handleKindChange(v as RouteValue["kind"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без маршрута</SelectItem>
              {templateDefaultWorkflowId && (
                <SelectItem value="template_default">По умолчанию (из шаблона)</SelectItem>
              )}
              <SelectItem value="workflow">Выбрать существующий маршрут</SelectItem>
              {templateAllowCustom && (
                <SelectItem value="custom">Собрать собственный маршрут</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {value.kind === "workflow" && (
          <div>
            <Label>Маршрут</Label>
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

        {value.kind === "custom" && (
          <div className="space-y-2">
            {steps.length === 0 && (
              <p className="text-sm text-muted-foreground">Шагов пока нет</p>
            )}
            {steps.map((step, idx) => (
              <div key={idx} className="border rounded-sm p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Шаг {idx + 1}</Badge>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveStep(idx, -1)}
                      disabled={idx === 0}
                      type="button"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveStep(idx, 1)}
                      disabled={idx === steps.length - 1}
                      type="button"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeStep(idx)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Тип исполнителя</Label>
                    <Select
                      value={step.assignee_mode}
                      onValueChange={(v) =>
                        updateStep(idx, { assignee_mode: v as RouteStep["assignee_mode"] })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Пользователь</SelectItem>
                        <SelectItem value="position">Должность</SelectItem>
                        <SelectItem value="department_head">Руководитель подразделения</SelectItem>
                        <SelectItem value="role">Роль</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Действие</Label>
                    <Select
                      value={step.action}
                      onValueChange={(v) =>
                        updateStep(idx, { action: v as RouteStep["action"] })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approve">Согласование</SelectItem>
                        <SelectItem value="sign">Подписание</SelectItem>
                        <SelectItem value="review">Ознакомление</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {step.assignee_mode === "user" && (
                  <div>
                    <Label className="text-xs">Пользователь</Label>
                    <Select
                      value={step.assignee_user_id ?? ""}
                      onValueChange={(v) => updateStep(idx, { assignee_user_id: v })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                      <SelectContent>
                        {(users as any[]).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name_ru || u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {step.assignee_mode === "position" && (
                  <div>
                    <Label className="text-xs">Должность</Label>
                    <Select
                      value={step.assignee_position_id ?? ""}
                      onValueChange={(v) => updateStep(idx, { assignee_position_id: v })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                      <SelectContent>
                        {(positions as any[]).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title_ru}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {step.assignee_mode === "department_head" && (
                  <div>
                    <Label className="text-xs">Подразделение</Label>
                    <Select
                      value={step.assignee_department_id ?? ""}
                      onValueChange={(v) => updateStep(idx, { assignee_department_id: v })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                      <SelectContent>
                        {(departments as any[]).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name_ru} ({d.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {step.assignee_mode === "role" && (
                  <div>
                    <Label className="text-xs">Роль</Label>
                    <Select
                      value={step.assignee_role ?? ""}
                      onValueChange={(v) => updateStep(idx, { assignee_role: v })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Выберите" />
                      </SelectTrigger>
                      <SelectContent>
                        {(roles as any[]).map((r) => (
                          <SelectItem key={r.role} value={r.role}>
                            {r.title_ru || r.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">SLA (часы)</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={step.sla_hours}
                      onChange={(e) => updateStep(idx, { sla_hours: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Метка шага</Label>
                    <Input
                      className="h-8"
                      value={step.label ?? ""}
                      onChange={(e) => updateStep(idx, { label: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" type="button" onClick={addStep}>
              <Plus className="h-4 w-4 mr-1" /> Добавить шаг
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
