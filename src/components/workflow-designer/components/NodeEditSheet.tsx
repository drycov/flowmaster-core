import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { Combobox } from "./Combobox";
import { NODE_TYPE_ICONS, NODE_TYPE_LABELS } from "../constants";
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
  if (!node) return null;

  const getAssigneeOptions = () => {
    const assigneeType = node.data.assignee_type || "user";

    switch (assigneeType) {
      case "user":
        return (users || []).map((u) => ({ value: u.id, label: `${u.name} (${u.role})`, metadata: u }));
      case "role":
        return (roles || []).map((r) => ({ value: r.id, label: r.name, metadata: r }));
      case "department":
        return (departments || []).map((d) => ({ value: d.id, label: d.name, metadata: d }));
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
                <Label>Тип ответственного</Label>
                <Select
                  value={node.data.assignee_type || "user"}
                  onValueChange={(v: AssigneeType) => onUpdate({ assignee_type: v, assignee_id: null })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Конкретный сотрудник</SelectItem>
                    <SelectItem value="role">Роль / Должность</SelectItem>
                    <SelectItem value="department">Подразделение</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {node.data.assignee_type === "user"
                    ? "Сотрудник"
                    : node.data.assignee_type === "role"
                    ? "Роль"
                    : "Подразделение"}
                </Label>
                <Combobox
                  options={getAssigneeOptions()}
                  value={node.data.assignee_id || undefined}
                  onChange={(value) => onUpdate({ assignee_id: value || null })}
                  placeholder={`Выберите ${
                    node.data.assignee_type === "user"
                      ? "сотрудника"
                      : node.data.assignee_type === "role"
                      ? "роль"
                      : "подразделение"
                  }`}
                  disabled={!users && !roles && !departments}
                  isLoading={!users && !roles && !departments}
                />
              </div>
            </>
          )}

          {showSlaBlock && (
            <>
              <div className="space-y-2">
                <Label>SLA (Service Level Agreement)</Label>
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
                <input
                  type="checkbox"
                  id="workingHoursOnly"
                  checked={node.data.sla_working_hours_only || false}
                  onChange={(e) => onUpdate({ sla_working_hours_only: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="workingHoursOnly" className="text-sm font-normal cursor-pointer">
                  Учитывать только рабочее время (согласно производственному календарю)
                </Label>
              </div>
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