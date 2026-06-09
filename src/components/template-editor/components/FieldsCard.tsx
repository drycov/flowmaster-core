import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { useI18n } from "@/i18n";
import { FieldItem } from "./FieldItem";
import type { Field } from "../types";

interface FieldsCardProps {
  fields: Field[];
  onAddField: () => void;
  onUpdateField: (index: number, patch: Partial<Field>) => void;
  onDeleteField: (index: number) => void;
  isLoading?: boolean;
}

export function FieldsCard({
  fields,
  onAddField,
  onUpdateField,
  onDeleteField,
  isLoading,
}: FieldsCardProps) {
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
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("tpl.fileTemplate.parsing")}
          </div>
        )}
        {!isLoading && fields.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">
            <p>{t("tpl.noFields")}</p>
            <p className="text-xs mt-1">{t("tpl.noFieldsHint")}</p>
          </div>
        )}
        
        {!isLoading && fields.map((field, index) => (
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