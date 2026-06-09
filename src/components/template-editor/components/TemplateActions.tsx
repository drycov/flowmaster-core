import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/i18n";

interface TemplateActionsProps {
  status: "draft" | "published" | "archived";
  onStatusChange: (value: "draft" | "published" | "archived") => void;
  onSave: () => void;
  isSaving: boolean;
}

export function TemplateActions({ status, onStatusChange, onSave, isSaving }: TemplateActionsProps) {
  const { t } = useI18n();

  return (
    <>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-36 h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="draft">{t("wf.draft")}</SelectItem>
          <SelectItem value="published">{t("wf.published")}</SelectItem>
          <SelectItem value="archived">{t("status.archived")}</SelectItem>
        </SelectContent>
      </Select>
      
      <Button size="sm" onClick={onSave} disabled={isSaving}>
        {isSaving ? t("tpl.saving") : t("common.save")}
      </Button>
    </>
  );
}