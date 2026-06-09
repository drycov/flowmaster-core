import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { parseDateKey } from "./business-calendar-utils";

interface BusinessDayEditDialogProps {
  open: boolean;
  dayDate: string | null;
  isHoliday: boolean;
  nameRu: string;
  nameKk: string;
  hasOverride: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onIsHolidayChange: (v: boolean) => void;
  onNameRuChange: (v: string) => void;
  onNameKkChange: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
}

export function BusinessDayEditDialog({
  open,
  dayDate,
  isHoliday,
  nameRu,
  nameKk,
  hasOverride,
  saving,
  onOpenChange,
  onIsHolidayChange,
  onNameRuChange,
  onNameKkChange,
  onSave,
  onReset,
}: BusinessDayEditDialogProps) {
  const { t, locale } = useI18n();

  const formatted = dayDate
    ? parseDateKey(dayDate).toLocaleDateString(locale === "kk" ? "kk-KZ" : "ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("calendar.editDay")}</DialogTitle>
        </DialogHeader>
        {dayDate ? (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground capitalize">{formatted}</p>
            <div className="flex items-center gap-2">
              <Switch checked={isHoliday} onCheckedChange={onIsHolidayChange} id="day-holiday" />
              <Label htmlFor="day-holiday">{t("calendar.isHoliday")}</Label>
            </div>
            <div>
              <Label>{t("calendar.nameRu")}</Label>
              <Input value={nameRu} onChange={(e) => onNameRuChange(e.target.value)} />
            </div>
            <div>
              <Label>{t("calendar.nameKk")}</Label>
              <Input value={nameKk} onChange={(e) => onNameKkChange(e.target.value)} />
            </div>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          {hasOverride ? (
            <Button type="button" variant="outline" onClick={onReset} disabled={saving}>
              {t("calendar.resetDay")}
            </Button>
          ) : null}
          <Button type="button" onClick={onSave} disabled={!dayDate || saving}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
