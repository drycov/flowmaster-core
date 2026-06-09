// src/components/template-editor/components/MetadataCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";

interface MetadataCardProps {
  nameRu: string;
  nameKk: string;
  category: string;
  description: string;
  onNameRuChange: (value: string) => void;
  onNameKkChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export function MetadataCard({
  nameRu = "",
  nameKk = "",
  category = "",
  description = "",
  onNameRuChange,
  onNameKkChange,
  onCategoryChange,
  onDescriptionChange,
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
            placeholder={t("tpl.nameRuPlaceholder")}
          />
        </div>

        <div>
          <Label>{t("common.name")} (KK)</Label>
          <Input
            value={nameKk}
            onChange={(e) => onNameKkChange(e.target.value)}
            placeholder={t("tpl.nameKkPlaceholder")}
          />
        </div>

        <div>
          <Label>{t("tpl.description")}</Label>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder={t("tpl.descriptionPlaceholder")}
            rows={3}
            className="resize-y min-h-[72px]"
          />
        </div>

        <div>
          <Label>{t("tpl.category")}</Label>
          <Input
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            placeholder={t("tpl.categoryPlaceholder")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
