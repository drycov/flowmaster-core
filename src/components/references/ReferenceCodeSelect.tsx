import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localized } from "@/i18n";

export type ReferenceCodeOption = {
  code: string;
  name_ru: string;
  name_kk: string;
};

interface ReferenceCodeSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReferenceCodeOption[];
  locale: "ru" | "kk";
  placeholder?: string;
  isLoading?: boolean;
  required?: boolean;
}

export function ReferenceCodeSelect({
  label,
  value,
  onChange,
  options,
  locale,
  placeholder = "—",
  isLoading,
  required,
}: ReferenceCodeSelectProps) {
  const knownCodes = new Set(options.map((opt) => opt.code));
  const showOrphan = value && !knownCodes.has(value);

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
          {showOrphan ? <SelectItem value={value}>{value}</SelectItem> : null}
          {options.map((opt) => (
            <SelectItem key={opt.code} value={opt.code}>
              {localized(opt, locale, "name")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
