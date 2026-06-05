// src/components/template-editor/components/MetadataCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

interface MetadataCardProps {
  nameRu: string;
  nameKk: string;
  category: string;
  onNameRuChange: (value: string) => void;
  onNameKkChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}

export function MetadataCard({
  nameRu = "",
  nameKk = "",
  category = "",
  onNameRuChange,
  onNameKkChange,
  onCategoryChange,
}: MetadataCardProps) {
  const { t } = useI18n();

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t("doc.metadata")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>{t("common.name")} (RU) *</Label>
          <Input 
            value={nameRu} 
            onChange={(e) => onNameRuChange(e.target.value)} 
            placeholder="Название шаблона на русском"
          />
        </div>
        
        <div>
          <Label>{t("common.name")} (KK)</Label>
          <Input 
            value={nameKk} 
            onChange={(e) => onNameKkChange(e.target.value)} 
            placeholder="Үлгінің қазақша атауы"
          />
        </div>
        
        <div>
          <Label>Категория</Label>
          <Input 
            value={category} 
            onChange={(e) => onCategoryChange(e.target.value)} 
            placeholder="Категория шаблона"
          />
        </div>
      </CardContent>
    </Card>
  );
}