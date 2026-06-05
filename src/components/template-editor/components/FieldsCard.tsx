import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { FieldItem } from "./FieldItem";
import type { Field } from "../types";

interface FieldsCardProps {
  fields: Field[];
  onAddField: () => void;
  onUpdateField: (index: number, patch: Partial<Field>) => void;
  onDeleteField: (index: number) => void;
}

export function FieldsCard({ fields, onAddField, onUpdateField, onDeleteField }: FieldsCardProps) {
  const { t } = useI18n();

  return (
    <Card className="rounded-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{t("tpl.fields")}</CardTitle>
        <Button variant="outline" size="sm" onClick={onAddField}>
          <Plus className="w-3 h-3 mr-1" />
          {t("tpl.add_field")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {fields.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            <p>Нет полей</p>
            <p className="text-xs mt-1">Добавьте поля для заполнения при создании документа</p>
          </div>
        )}
        
        {fields.map((field, index) => (
          <FieldItem
            key={index}
            field={field}
            index={index}
            onUpdate={(patch) => onUpdateField(index, patch)}
            onDelete={() => onDeleteField(index)}
          />
        ))}
      </CardContent>
    </Card>
  );
}