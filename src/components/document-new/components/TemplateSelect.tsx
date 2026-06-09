import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n, localized } from "@/i18n";
import type { Template } from "../types";

interface TemplateSelectProps {
  value: string;
  onChange: (value: string) => void;
  templates: Template[];
  isLoading?: boolean;
}

export function TemplateSelect({ value, onChange, templates, isLoading }: TemplateSelectProps) {
  const { t, locale } = useI18n();
  const publishedTemplates = templates.filter((tp) => tp.status === "published");

  return (
    <div>
      <Label>{t("doc.from_template")}</Label>
      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger>
          <SelectValue placeholder={t("doc.no_template")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("doc.no_template")}</SelectItem>
          {publishedTemplates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {localized(template, locale, "name")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}