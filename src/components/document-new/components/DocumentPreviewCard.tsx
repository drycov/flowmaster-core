import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Maximize2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { TemplatePreviewPane } from "@/components/shared/TemplatePreviewPane";
import { useDocumentPreview } from "../hooks/useDocumentPreview";
import type { UseFormReturn } from "react-hook-form";
import type { DocumentFormValues, Template, TemplateField } from "../types";

interface DocumentPreviewCardProps {
  template: Template;
  form: UseFormReturn<DocumentFormValues>;
  templateFields: TemplateField[];
  authorDefaults?: Record<string, string>;
}

export function DocumentPreviewCard({
  template,
  form,
  templateFields,
  authorDefaults,
}: DocumentPreviewCardProps) {
  const { t } = useI18n();
  const [fullscreen, setFullscreen] = useState(false);

  const watchedKeys = useMemo(
    () => templateFields.map((field) => field.key),
    [templateFields],
  );
  const watchedValues = form.watch(watchedKeys.length > 0 ? watchedKeys : []);

  const fieldValues = useMemo(() => {
    const values: Record<string, string> = {};
    templateFields.forEach((field, index) => {
      const raw = Array.isArray(watchedValues) ? watchedValues[index] : watchedValues;
      const fromForm = form.getValues(field.key) as string | undefined;
      const value = fromForm ?? (typeof raw === "string" ? raw : "");
      if (value.trim()) {
        values[field.key] = value.trim();
      }
    });
    return values;
  }, [templateFields, watchedValues, form]);

  const preview = useDocumentPreview({
    template,
    fieldValues,
    authorDefaults,
  });

  const labels = {
    loading: t("doc.preview.loading"),
    error: t("doc.preview.error"),
    empty: t("doc.preview.empty"),
    unsupported: t("tpl.preview.unsupported"),
  };

  const hasPreview = preview.mode !== "empty";

  return (
    <>
      <Card className="flex h-full min-h-0 flex-col rounded-sm">
        <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">{t("doc.preview.title")}</CardTitle>
          {hasPreview && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setFullscreen(true)}
              title={t("tpl.preview.fullscreen")}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <p className="mb-3 shrink-0 text-xs text-muted-foreground">{t("doc.preview.hint")}</p>
          <div className="flex min-h-0 flex-1 flex-col">
            <TemplatePreviewPane
              status={preview.status}
              isRefreshing={preview.isRefreshing}
              error={preview.error}
              html={preview.html}
              mode={preview.mode}
              docxBlob={preview.docxBlob}
              fill
              labels={labels}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t("doc.preview.title")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            {fullscreen && (
              <TemplatePreviewPane
                status={preview.status}
                isRefreshing={preview.isRefreshing}
                error={preview.error}
                html={preview.html}
                mode={preview.mode}
                docxBlob={preview.docxBlob}
                fullscreen
                labels={labels}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
