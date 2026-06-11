import { useState } from "react";
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
import { Trash2, ArrowRight, Code2, MousePointerSquareDashed } from "lucide-react";
import { OPERATORS } from "../constants";
import { parseCondition, buildCondition } from "../utils/condition-builder";
import { useI18n } from "@/i18n";
import type { FlowNode, FlowEdge, DocumentField } from "../types";

interface EdgePropertiesFormProps {
  edge: FlowEdge;
  sourceNode?: FlowNode;
  targetNode?: FlowNode;
  documentFields?: DocumentField[];
  onUpdate: (updates: { label?: string; condition?: string }) => void;
  onDelete: () => void;
}

export function EdgePropertiesForm({
  edge,
  sourceNode,
  targetNode,
  documentFields,
  onUpdate,
  onDelete,
}: EdgePropertiesFormProps) {
  const { t } = useI18n();
  const [isRawCondition, setIsRawCondition] = useState(false);
  const parsedCondition = parseCondition(edge.data?.condition);

  const handleVisualConditionChange = (field: string, operator: string, value: string) => {
    onUpdate({ condition: buildCondition(field, operator, value) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
        <span className="truncate font-medium">{sourceNode?.data.label || sourceNode?.id}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{targetNode?.data.label || targetNode?.id}</span>
      </div>

      <div className="space-y-2">
        <Label>{t("wf.edgeLabel")}</Label>
        <Input
          value={typeof edge.label === "string" ? edge.label : ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder={t("wf.edgeLabel")}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t("wf.edgeCondition")}</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setIsRawCondition(!isRawCondition)}
          >
            {isRawCondition ? (
              <MousePointerSquareDashed className="mr-1 h-3 w-3" />
            ) : (
              <Code2 className="mr-1 h-3 w-3" />
            )}
            {isRawCondition ? t("wf.visualBuilder") : t("wf.codeMode")}
          </Button>
        </div>

        {!isRawCondition ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="space-y-2">
              <Label className="text-xs">{t("wf.docField")}</Label>
              <Select
                value={parsedCondition.field}
                onValueChange={(v) =>
                  handleVisualConditionChange(v, parsedCondition.operator, parsedCondition.value)
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={t("wf.selectField")} />
                </SelectTrigger>
                <SelectContent>
                  {(documentFields || []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">{t("wf.operator")}</Label>
                <Select
                  value={parsedCondition.operator}
                  onValueChange={(v) =>
                    handleVisualConditionChange(parsedCondition.field, v, parsedCondition.value)
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {t(op.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("wf.value")}</Label>
                <Input
                  className="bg-background"
                  value={parsedCondition.value}
                  onChange={(e) =>
                    handleVisualConditionChange(
                      parsedCondition.field,
                      parsedCondition.operator,
                      e.target.value,
                    )
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <Textarea
            value={edge.data?.condition || ""}
            onChange={(e) => onUpdate({ condition: e.target.value })}
            placeholder="data.status === 'APPROVED'"
            className="font-mono text-sm"
            rows={4}
          />
        )}
        <p className="text-xs text-muted-foreground">{t("wf.edgeConditionHint")}</p>
      </div>

      <Button variant="destructive" size="sm" onClick={onDelete} className="w-full">
        <Trash2 className="mr-2 h-4 w-4" />
        {t("wf.deleteEdge")}
      </Button>
    </div>
  );
}
