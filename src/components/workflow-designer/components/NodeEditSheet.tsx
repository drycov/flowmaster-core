import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "./Combobox";
import { NODE_TYPE_ICONS, NODE_TYPE_LABEL_KEYS } from "../constants";
import { useI18n } from "@/i18n";
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

const ASSIGNEE_MODE_KEYS: { value: AssigneeType; labelKey: string; needsRef: boolean }[] = [
  { value: "user", labelKey: "wf.assignee.user", needsRef: true },
  { value: "position", labelKey: "wf.assignee.position", needsRef: true },
  { value: "department", labelKey: "wf.assignee.department", needsRef: true },
  { value: "department_head", labelKey: "wf.assignee.deptHead", needsRef: true },
  { value: "parent_department_head", labelKey: "wf.assignee.parentDeptHead", needsRef: true },
  { value: "initiator_manager", labelKey: "wf.assignee.initiatorManager", needsRef: false },
  { value: "role", labelKey: "wf.assignee.role", needsRef: true },
  { value: "group", labelKey: "wf.assignee.group", needsRef: true },
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
  const { t } = useI18n();
  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: () => listPositions(),
  });

  if (!node) return null;

  const assigneeType = (node.data.assignee_type || "user") as AssigneeType;
  const modeMeta = ASSIGNEE_MODE_KEYS.find((m) => m.value === assigneeType);

  const getAssigneeOptions = () => {
    switch (assigneeType) {
      case "user":
        return (users || []).map((u) => ({
          value: u.id,
          label: `${u.name} (${u.role})`,
          metadata: u,
        }));
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
      <SheetContent
        className="w-[450px] sm:w-[540px] overflow-y-auto shadow-xl border-l"
        style={{ zIndex: 40 }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>{NODE_TYPE_ICONS[node.data.type]}</span>
            <span>{t("wf.editNode")}</span>
          </SheetTitle>
          <SheetDescription>
            {t("common.type")}: {t(NODE_TYPE_LABEL_KEYS[node.data.type])}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label>{t("wf.nodeNameRu")}</Label>
            <Input
              value={node.data.label || ""}
              onChange={(e) => onUpdate({ label: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("wf.nodeNameKk")}</Label>
            <Input
              value={(node.data.config?.label_kk as string) || ""}
              onChange={(e) =>
                onUpdate({ config: { ...node.data.config, label_kk: e.target.value } })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>{t("wf.nodeDescription")}</Label>
            <Textarea
              value={node.data.description || ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              rows={3}
            />
          </div>

          {showAssigneeBlock && (
            <>
              <div className="space-y-2">
                <Label>{t("wf.assigneeBlock")}</Label>
                <Select
                  value={assigneeType}
                  onValueChange={(v: AssigneeType) =>
                    onUpdate({ assignee_type: v, assignee_id: null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNEE_MODE_KEYS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {t(m.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("wf.assigneeHint")}</p>
              </div>

              {modeMeta?.needsRef && (
                <div className="space-y-2">
                  <Label>{t("wf.assigneeSource")}</Label>
                  <Combobox
                    options={getAssigneeOptions()}
                    value={node.data.assignee_id || undefined}
                    onChange={(value) => onUpdate({ assignee_id: value || null })}
                    placeholder={t("wf.selectValue")}
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
                  {t("wf.requiredStep")}
                </Label>
              </div>

              <div className="space-y-2">
                <Label>{t("wf.parallelMode")}</Label>
                <Select
                  value={(node.data.config?.parallel_mode as string) || "all"}
                  onValueChange={(v: "all" | "any") =>
                    onUpdate({ config: { ...node.data.config, parallel_mode: v } })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("wf.parallel.all")}</SelectItem>
                    <SelectItem value="any">{t("wf.parallel.any")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("wf.parallelHint")}</p>
              </div>
            </>
          )}

          {node.data.type === "SIGNATURE" && (
            <div className="space-y-2">
              <Label>{t("wf.signatureProvider")}</Label>
              <Select
                value={(node.data.config?.signature_provider as string) || "ncalayer"}
                onValueChange={(v) =>
                  onUpdate({ config: { ...node.data.config, signature_provider: v } })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ncalayer">NCALayer (ЭЦП РК)</SelectItem>
                  <SelectItem value="any">{t("wf.signature.any")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showSlaBlock && (
            <>
              <div className="space-y-2">
                <Label>{t("wf.slaDuration")}</Label>
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
                      <SelectItem value="hours">{t("wf.sla.hours")}</SelectItem>
                      <SelectItem value="business_days">{t("wf.sla.workdays")}</SelectItem>
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
                  {t("wf.workingHoursOnly")}
                </Label>
              </div>

              <div className="space-y-2">
                <Label>{t("wf.timeoutAction")}</Label>
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
                    <SelectItem value="notify">{t("wf.timeout.notify")}</SelectItem>
                    <SelectItem value="reassign">{t("wf.timeout.reassign")}</SelectItem>
                    <SelectItem value="approve">{t("wf.timeout.approve")}</SelectItem>
                    <SelectItem value="reject">{t("wf.timeout.reject")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(node.data.config?.timeout_action as string) === "reassign" && (
                <div className="space-y-2">
                  <Label>{t("wf.escalationRole")}</Label>
                  <Combobox
                    options={(roles || []).map((r) => ({
                      value: (r as unknown as { code?: string }).code || r.id,
                      label: r.name,
                    }))}
                    value={(node.data.config?.escalation_role as string) || undefined}
                    onChange={(v) =>
                      onUpdate({ config: { ...node.data.config, escalation_role: v || null } })
                    }
                    placeholder={t("wf.selectRole")}
                  />
                  <p className="text-xs text-muted-foreground">{t("wf.escalationRoleHint")}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>{t("wf.maxEscalations")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={String((node.data.config?.max_escalations as number) ?? 5)}
                    onChange={(e) => {
                      const v = Math.min(20, Math.max(1, Number(e.target.value) || 5));
                      onUpdate({ config: { ...node.data.config, max_escalations: v } });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("wf.slaRepeatHours")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={String((node.data.config?.sla_repeat_hours as number) ?? 24)}
                    onChange={(e) => {
                      const v = Math.min(168, Math.max(1, Number(e.target.value) || 24));
                      onUpdate({ config: { ...node.data.config, sla_repeat_hours: v } });
                    }}
                  />
                </div>
              </div>

              {((node.data.config?.timeout_action as string) === "approve" ||
                (node.data.config?.timeout_action as string) === "reject") && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-sm p-2">
                  {t("wf.timeout.systemNote")}
                </p>
              )}
            </>
          )}

          <div className="border-t pt-4">
            <Button variant="destructive" onClick={onDeleteConfirm} className="w-full">
              <Trash2 className="w-4 h-4 mr-2" />
              {t("wf.deleteNode")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
