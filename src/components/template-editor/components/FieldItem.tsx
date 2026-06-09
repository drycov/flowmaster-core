import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, GripVertical } from "lucide-react";
import { useI18n } from "@/i18n";
import type { Field, FieldType } from "../types";

interface FieldItemProps {
  field: Field;
  index: number;
  onUpdate: (patch: Partial<Field>) => void;
  onDelete: () => void;
}

export function FieldItem({ field, index, onUpdate, onDelete }: FieldItemProps) {
  const { t } = useI18n();

  const fieldTypes: { value: FieldType; label: string }[] = [
    { value: "text", label: t("tpl.field.text") },
    { value: "textarea", label: t("tpl.field.textarea") },
    { value: "number", label: t("tpl.field.number") },
    { value: "date", label: t("tpl.field.date") },
  ];

  return (
    <div className="border border-border rounded-sm p-3 space-y-2 group relative">
      <div className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-3 h-3" />
      </div>

      <div className="pl-6 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder={t("tpl.field.keyPlaceholder")}
            value={field.key}
            onChange={(e) => onUpdate({ key: e.target.value })}
            className="font-mono text-xs"
          />
          <Select value={field.type} onValueChange={(v) => onUpdate({ type: v as FieldType })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fieldTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input
          placeholder={t("tpl.field.labelRu")}
          value={field.label_ru}
          onChange={(e) => onUpdate({ label_ru: e.target.value })}
        />

        <Input
          placeholder={t("tpl.field.labelKk")}
          value={field.label_kk}
          onChange={(e) => onUpdate({ label_kk: e.target.value })}
        />

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={field.required || false}
              onChange={(e) => onUpdate({ required: e.target.checked })}
              className="rounded border-gray-300"
            />
            {t("tpl.field.required")}
          </label>

          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="w-3 h-3 mr-1" />
            {t("common.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
