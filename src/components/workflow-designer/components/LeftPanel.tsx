import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NODE_TYPES, NODE_TYPE_LABELS, NODE_TYPE_ICONS } from "../constants";
import type { WorkflowStatus } from "../types";

interface LeftPanelProps {
  nameRu: string;
  nameKk: string;
  description: string;
  status: WorkflowStatus;
  validationErrors: string[];
  nodesCount: number;
  edgesCount: number;
  onNameRuChange: (value: string) => void;
  onNameKkChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onStatusChange: (value: WorkflowStatus) => void;
  onAddNode: (type: string) => void;
}

export function LeftPanel({
  nameRu,
  nameKk,
  description,
  status,
  validationErrors,
  nodesCount,
  edgesCount,
  onNameRuChange,
  onNameKkChange,
  onDescriptionChange,
  onStatusChange,
  onAddNode,
}: LeftPanelProps) {
  return (
    <div className="space-y-4 overflow-y-auto pr-2">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Название (RU)</Label>
        <Input value={nameRu} onChange={(e) => onNameRuChange(e.target.value)} placeholder="Название на русском" />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Название (KK)</Label>
        <Input value={nameKk} onChange={(e) => onNameKkChange(e.target.value)} placeholder="Қазақша атауы" />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Описание</Label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Описание workflow"
          rows={3}
        />
      </div>

      {validationErrors.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-1">
          <Label className="text-red-800 text-sm font-semibold">Ошибки валидации:</Label>
          {validationErrors.map((error, idx) => (
            <div key={idx} className="text-red-700 text-xs flex items-start gap-2">
              <span className="mt-0.5">•</span>
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-4">
        <Label className="text-sm font-semibold mb-2 block">Добавить узел</Label>
        <div className="grid grid-cols-2 gap-2">
          {NODE_TYPES.map((tp) => (
            <Button key={tp} size="sm" variant="outline" onClick={() => onAddNode(tp)} className="justify-start px-2">
              <span className="mr-1">{NODE_TYPE_ICONS[tp]}</span>
              <span className="text-xs">{NODE_TYPE_LABELS[tp]}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Узлов: {nodesCount}</div>
          <div>Связей: {edgesCount}</div>
        </div>
      </div>
    </div>
  );
}