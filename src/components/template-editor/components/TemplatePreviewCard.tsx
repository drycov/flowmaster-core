import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Maximize2, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n";
import { TemplatePreviewPane } from "@/components/shared/TemplatePreviewPane";
import { useTemplatePreview } from "../hooks/useTemplatePreview";
import type { Field } from "../types";

interface Props {
  filePath: string | null;
  fileFormat: string | null;
  body: string;
  fields: Field[];
  nameRu?: string;
  nameKk?: string;
}

export function TemplatePreviewCard({
  filePath,
  fileFormat,
  body,
  fields,
  nameRu,
  nameKk,
}: Props) {
  const { t } = useI18n();
  const [fullscreen, setFullscreen] = useState(false);
  const preview = useTemplatePreview({
    filePath,
    fileFormat,
    body,
    fields,
    nameRu,
    nameKk,
  });

  const hasPreview = preview.mode !== "empty";
  const labels = {
    loading: t("tpl.preview.loading"),
    error: t("tpl.preview.error"),
    empty: t("tpl.preview.empty"),
    unsupported: t("tpl.preview.unsupported"),
  };

  return (
    <>
      <Card className="flex h-full min-h-0 flex-col rounded-sm">
        <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">{t("tpl.preview.title")}</CardTitle>
          <div className="flex gap-1">
            {hasPreview && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => preview.reload()}
                title={t("tpl.preview.refresh")}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
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
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <p className="mb-3 shrink-0 text-xs text-muted-foreground">{t("tpl.preview.hint")}</p>
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
            <DialogTitle>{t("tpl.preview.title")}</DialogTitle>
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
