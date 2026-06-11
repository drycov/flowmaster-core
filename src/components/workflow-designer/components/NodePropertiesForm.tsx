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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Trash2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "./Combobox";
import { NODE_TYPE_LABEL_KEYS } from "../constants";
import { WorkflowNodeIcon } from "./WorkflowNodeIcon";
import { useI18n } from "@/i18n";
import { listPositions } from "@/lib/api/org.functions";
import type { FlowNode, AssigneeType, User, Role, Department } from "../types";

const ASSIGNEE_MODE_KEYS: { value: AssigneeType; labelKey: string; needsRef: boolean }[] = [
  { value: "user", labelKey: "wf.assignee.user", needsRef: true },
  { value: "initiator", labelKey: "wf.assignee.initiator", needsRef: false },
  { value: "position", labelKey: "wf.assignee.position", needsRef: true },
  { value: "department", labelKey: "wf.assignee.department", needsRef: true },
  { value: "department_head", labelKey: "wf.assignee.deptHead", needsRef: true },
  { value: "parent_department_head", labelKey: "wf.assignee.parentDeptHead", needsRef: true },
  { value: "initiator_manager", labelKey: "wf.assignee.initiatorManager", needsRef: false },
  { value: "role", labelKey: "wf.assignee.role", needsRef: true },
  { value: "group", labelKey: "wf.assignee.group", needsRef: true },
];

const REF_REQUIRED = new Set(
  ASSIGNEE_MODE_KEYS.filter((m) => m.needsRef).map((m) => m.value),
);

interface NodePropertiesFormProps {
  node: FlowNode;
  users?: User[];
  roles?: Role[];
  departments?: Department[];
  onUpdate: (updates: Partial<FlowNode["data"]>) => void;
  onDelete: () => void;
}

export function NodePropertiesForm({
  node,
  users,
  roles,
  departments,
  onUpdate,
  onDelete,
}: NodePropertiesFormProps) {
  const { t } = useI18n();
  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: () => listPositions(),
  });

  const assigneeType = (node.data.assignee_type || "user") as AssigneeType;
  const modeMeta = ASSIGNEE_MODE_KEYS.find((m) => m.value === assigneeType);
  const missingAssignee =
    ["APPROVAL", "SIGNATURE", "TASK"].includes(node.data.type) &&
    REF_REQUIRED.has(assigneeType) &&
    !node.data.assignee_id;

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
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3">
        <WorkflowNodeIcon type={node.data.type} className="h-5 w-5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t(NODE_TYPE_LABEL_KEYS[node.data.type])}</p>
          <p className="truncate text-xs text-muted-foreground">{node.id}</p>
        </div>
      </div>

      {missingAssignee && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("wf.properties.missingAssignee")}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label>{t("wf.nodeNameRu")}</Label>
        <Input
          value={node.data.label || ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder={t(NODE_TYPE_LABEL_KEYS[node.data.type])}
        />
      </div>

      {showAssigneeBlock && (
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("wf.assigneeBlock")}
          </p>
          <div className="space-y-2">
            <Label>{t("wf.assigneeBlock")}</Label>
            <Select
              value={assigneeType}
              onValueChange={(v: AssigneeType) => onUpdate({ assignee_type: v, assignee_id: null })}
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
            <Label htmlFor="isRequired" className="cursor-pointer text-sm font-normal">
              {t("wf.requiredStep")}
            </Label>
          </div>
        </div>
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

      <Accordion type="multiple" className="w-full">
        <AccordionItem value="details">
          <AccordionTrigger className="py-2 text-sm">{t("wf.properties.details")}</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-2">
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
                rows={2}
              />
            </div>
            {showAssigneeBlock && (
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
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {showSlaBlock && (
          <AccordionItem value="sla">
            <AccordionTrigger className="py-2 text-sm">{t("wf.slaDuration")}</AccordionTrigger>
            <AccordionContent className="space-y-3 pb-2">
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
                  placeholder="72"
                />
                <Select
                  value={node.data.sla_unit || "hours"}
                  onValueChange={(v: "hours" | "business_days") => onUpdate({ sla_unit: v })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">{t("wf.sla.hours")}</SelectItem>
                    <SelectItem value="business_days">{t("wf.sla.workdays")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="workingHoursOnly"
                  checked={node.data.sla_working_hours_only || false}
                  onCheckedChange={(c) => onUpdate({ sla_working_hours_only: !!c })}
                />
                <Label htmlFor="workingHoursOnly" className="cursor-pointer text-sm font-normal">
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
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      <Button variant="destructive" size="sm" onClick={onDelete} className="w-full">
        <Trash2 className="mr-2 h-4 w-4" />
        {t("wf.deleteNode")}
      </Button>
    </div>
  );
}
