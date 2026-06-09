import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "./Combobox";
import { NODE_TYPE_ICONS, NODE_TYPE_LABELS } from "../constants";
import { listPositions } from "@/lib/api/org.functions";
import type { FlowNode, AssigneeType, User, Role, Department } from "../types";

interface NodeEditSheetProps {
  open: boolean;
  node: FlowNode | null;
  users?: User[];
  roles?: Role[];
  departments?: Department[];
  onClose: () => void;
  onUpdate: (updates: Partial<FlowNode["data"]>) => void;
  onDelete: () => void;
  onDeleteConfirm: () => void;
}

const ASSIGNEE_MODES: { value: AssigneeType; label: string; needsRef: boolean }[] = [
  { value: "user", label: "Конкретный сотрудник", needsRef: true },
  { value: "position", label: "Должность", needsRef: true },
  { value: "department", label: "Подразделение (любой сотрудник)", needsRef: true },
  { value: "department_head", label: "Руководитель подразделения", needsRef: true },
  { value: "parent_department_head", label: "Руководитель родительского подразделения", needsRef: true },
  { value: "initiator_manager", label: "Руководитель инициатора", needsRef: false },
  { value: "role", label: "По роли", needsRef: true },
  { value: "group", label: "Группа пользователей", needsRef: true },
];

export function NodeEditSheet({
  open,
  node,
  users,
  roles,
  departments,
  onClose,
  onUpdate,
  onDelete,
  onDeleteConfirm,
}: NodeEditSheetProps) {
  void onDelete;
  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: () => listPositions(),
  });

  if (!node) return null;

  const assigneeType = (node.data.assignee_type || "user") as AssigneeType;
  const modeMeta = ASSIGNEE_MODES.find((m) => m.value === assigneeType);

  const getAssigneeOptions = () => {
    switch (assigneeType) {
      case "user":
        return (users || []).map((u) => ({ value: u.id, label: `${u.name} (${u.role})`, metadata: u }));
      case "role":
        return (roles || []).map((r) => ({ value: r.id, label: r.name, metadata: r }));
      case "department":
      case "department_head":
      case "parent_department_head":
        return (departments || []).map((d) => ({ value: d.id, label: d.name, metadata: d }));
      case "position":
        return (positions as Array<{ id: string; title_ru: string }>).map((p) => ({
          value: p.id,
          label: p.title_ru,
        }));
      case "group":
        return (roles || []).map((r) => ({ value: r.id, label: r.name, metadata: r }));
      default:
        return [];
    }
  };

  const showAssigneeBlock = ["APPROVAL", "SIGNATURE", "TASK"].includes(node.data.type);
  const showSlaBlock = ["APPROVAL", "SIGNATURE", "TIMER", "ESCALATION"].includes(node.data.type);

  return (
    <Sheet open={open} onOpenChange={onClose} modal={false}>
      <SheetContent className="w-[450px] sm:w-[540px] overflow-y-auto shadow-xl border-l" style={{ zIndex: 40 }}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>{NODE_TYPE_ICONS[node.data.type]}</span>
            <span>Редактирование узла</span>
          </SheetTitle>
          <SheetDescription>Тип: {NODE_TYPE_LABELS[node.data.type]}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label>Название узла (RU)</Label>
            <Input value={node.data.label || ""} onChange={(e) => onUpdate({ label: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Название узла (KK)</Label>
            <Input
              value={(node.data.config?.label_kk as string) || ""}
              onChange={(e) => onUpdate({ config: { ...node.data.config, label_kk: e.target.value } })}
            />
          </div>

          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea
              value={node.data.description || ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              rows={3}
            />
          </div>

          {showAssigneeBlock && (
            <>
              <div className="space-y-2">
                <Label>Назначение исполнителя</Label>
                <Select
                  value={assigneeType}
                  onValueChange={(v: AssigneeType) => onUpdate({ assignee_type: v, assignee_id: null })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNEE_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Используется функцией <code>resolve_workflow_assignees</code> при запуске маршрута.
                </p>
              </div>

              {modeMeta?.needsRef && (
                <div className="space-y-2">
                  <Label>Источник</Label>
                  <Combobox
                    options={getAssigneeOptions()}
                    value={node.data.assignee_id || undefined}
                    onChange={(value) => onUpdate({ assignee_id: value || null })}
                    placeholder="Выберите значение"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="isRequired"
                  checked={(node.data.config?.is_required as boolean) ?? true}
                  onCheckedChange={(c) =>
                    onUpdate({ config: { ...node.data.config, is_required: !!c } })
                  }
                />
                <Label htmlFor="isRequired" className="text-sm font-normal cursor-pointer">
                  Обязательный этап (нельзя пропустить при модификации маршрута)
                </Label>
              </div>
            </>
          )}

          {showSlaBlock && (
            <>
              <div className="space-y-2">
                <Label>SLA</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    className="flex-1"
                    value={
                      node.data.sla_hours !== null && node.data.sla_hours !== undefined
                        ? String(node.data.sla_hours)
                        : ""
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      onUpdate({ sla_hours: value === "" ? null : Number(value) });
                    }}
                    placeholder="0"
                  />
                  <Select
                    value={node.data.sla_unit || "hours"}
                    onValueChange={(v: "hours" | "business_days") => onUpdate({ sla_unit: v })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">Часы</SelectItem>
                      <SelectItem value="business_days">Рабочие дни</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="workingHoursOnly"
                  checked={node.data.sla_working_hours_only || false}
                  onCheckedChange={(c) => onUpdate({ sla_working_hours_only: !!c })}
                />
                <Label htmlFor="workingHoursOnly" className="text-sm font-normal cursor-pointer">
                  Только рабочее время
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Действие при просрочке SLA</Label>
                <Select
                  value={(node.data.config?.timeout_action as string) || "notify"}
                  onValueChange={(v) =>
                    onUpdate({ config: { ...node.data.config, timeout_action: v } })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notify">Уведомить исполнителя и его руководителя</SelectItem>
                    <SelectItem value="reassign">Создать дубль на роль эскалации</SelectItem>
                    <SelectItem value="approve">Авто-одобрить</SelectItem>
                    <SelectItem value="reject">Авто-отклонить</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {((node.data.config?.timeout_action as string) === "reassign") && (
                <div className="space-y-2">
                  <Label>Роль эскалации (code)</Label>
                  <Combobox
                    options={(roles || []).map((r) => ({
                      value: (r as unknown as { code?: string }).code || r.id,
                      label: r.name,
                    }))}
                    value={(node.data.config?.escalation_role as string) || undefined}
                    onChange={(v) =>
                      onUpdate({ config: { ...node.data.config, escalation_role: v || null } })
                    }
                    placeholder="Выберите роль"
                  />
                  <p className="text-xs text-muted-foreground">
                    Задача будет продублирована на всех пользователей с активным грантом этой роли.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="border-t pt-4">
            <Button variant="destructive" onClick={onDeleteConfirm} className="w-full">
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить узел
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
