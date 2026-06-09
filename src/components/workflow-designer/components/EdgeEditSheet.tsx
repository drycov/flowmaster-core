import { useState } from "react";
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
import { Trash2, ArrowRight, Code2, MousePointerSquareDashed } from "lucide-react";
import { OPERATORS } from "../constants";
import { parseCondition, buildCondition } from "../utils/condition-builder";
import { useI18n } from "@/i18n";
import type { FlowNode, FlowEdge, DocumentField } from "../types";

interface EdgeEditSheetProps {
  open: boolean;
  edge: FlowEdge | null;
  sourceNode?: FlowNode;
  targetNode?: FlowNode;
  documentFields?: DocumentField[];
  onClose: () => void;
  onUpdate: (updates: { label?: string; condition?: string }) => void;
  onDelete: () => void;
}

export function EdgeEditSheet({
  open,
  edge,
  sourceNode,
  targetNode,
  documentFields,
  onClose,
  onUpdate,
  onDelete,
}: EdgeEditSheetProps) {
  const { t } = useI18n();
  const [isRawCondition, setIsRawCondition] = useState(false);

  if (!edge) return null;

  const parsedCondition = parseCondition(edge.data?.condition);
  const handleVisualConditionChange = (field: string, operator: string, value: string) => {
    const condition = buildCondition(field, operator, value);
    onUpdate({ condition });
  };

  return (
    <Sheet open={open} onOpenChange={onClose} modal={false}>
      <SheetContent
        className="w-[450px] sm:w-[540px] overflow-y-auto shadow-xl border-l"
        style={{ zIndex: 40 }}
      >
        <SheetHeader>
          <SheetTitle>{t("wf.editEdge")}</SheetTitle>
          <SheetDescription className="flex items-center gap-2 mt-2 text-sm text-slate-700">
            <span className="font-medium px-2 py-1 bg-slate-100 rounded border">
              {sourceNode?.data.label}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <span className="font-medium px-2 py-1 bg-slate-100 rounded border">
              {targetNode?.data.label}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
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
                className="h-6 text-xs px-2"
                onClick={() => setIsRawCondition(!isRawCondition)}
              >
                {isRawCondition ? (
                  <MousePointerSquareDashed className="w-3 h-3 mr-1" />
                ) : (
                  <Code2 className="w-3 h-3 mr-1" />
                )}
                {isRawCondition ? t("wf.visualBuilder") : t("wf.codeMode")}
              </Button>
            </div>

            {!isRawCondition ? (
              <div className="bg-slate-50 border rounded-md p-3 space-y-3">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t("wf.docField")}</label>
                    <Select
                      value={parsedCondition.field}
                      onValueChange={(v) =>
                        handleVisualConditionChange(
                          v,
                          parsedCondition.operator,
                          parsedCondition.value,
                        )
                      }
                    >
                      <SelectTrigger className="bg-white">
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

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t("wf.operator")}</label>
                    <Select
                      value={parsedCondition.operator}
                      onValueChange={(v) =>
                        handleVisualConditionChange(parsedCondition.field, v, parsedCondition.value)
                      }
                    >
                      <SelectTrigger className="bg-white w-[120px]">
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

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t("wf.value")}</label>
                    <Input
                      placeholder={t("wf.value")}
                      className="bg-white"
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
              <div className="space-y-2">
                <Textarea
                  value={edge.data?.condition || ""}
                  onChange={(e) => onUpdate({ condition: e.target.value })}
                  placeholder="data.status === 'APPROVED'"
                  className="font-mono text-sm bg-slate-900 text-green-400"
                  rows={4}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t("wf.edgeConditionHint")}</p>
          </div>

          <div className="border-t pt-4">
            <Button variant="destructive" onClick={onDelete} className="w-full">
              <Trash2 className="w-4 h-4 mr-2" />
              {t("wf.deleteEdge")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
