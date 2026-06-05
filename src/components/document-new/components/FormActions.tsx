import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

interface FormActionsProps {
  isSubmitting: boolean;
  onCancel?: () => void;
}

export function FormActions({ isSubmitting, onCancel }: FormActionsProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate({ to: "/documents" });
    }
  };

  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t("common.loading") : t("doc.register")}
      </Button>
      <Button type="button" variant="outline" onClick={handleCancel}>
        {t("common.cancel")}
      </Button>
    </div>
  );
}