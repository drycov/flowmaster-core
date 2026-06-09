import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, localized } from "@/i18n";
import type { Nomenclature } from "../types";

interface NomenclatureSelectProps {
  value: string;
  onChange: (value: string) => void;
  nomenclatures: Nomenclature[];
  isLoading?: boolean;
}

export function NomenclatureSelect({
  value,
  onChange,
  nomenclatures,
  isLoading,
}: NomenclatureSelectProps) {
  const { t, locale } = useI18n();

  return (
    <div>
      <Label>{t("nav.nomenclature")}</Label>
      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">—</SelectItem>
          {nomenclatures.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.code} · {localized(item, locale, "title")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
