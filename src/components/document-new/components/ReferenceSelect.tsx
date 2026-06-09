import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localized } from "@/i18n";

export type ReferenceOption = {
  id: string;
  code: string;
  name_ru: string;
  name_kk: string;
  bin?: string;
};

interface ReferenceSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReferenceOption[];
  locale: "ru" | "kk";
  placeholder?: string;
  isLoading?: boolean;
  required?: boolean;
}

export function ReferenceSelect({
  label,
  value,
  onChange,
  options,
  locale,
  placeholder = "—",
  isLoading,
  required,
}: ReferenceSelectProps) {
  return (
    <div>
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Select
        value={value || "none"}
        onValueChange={(v) => onChange(v === "none" ? "" : v)}
        disabled={isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{placeholder}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {localized(opt, locale, "name")}
              {opt.bin ? ` · ${opt.bin}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
