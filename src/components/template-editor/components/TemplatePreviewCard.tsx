import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Maximize2, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n";
import { TemplatePreviewPane } from "@/components/shared/TemplatePreviewPane";
import { OnlyOfficeEmbed } from "@/components/office/OnlyOfficeEmbed";
import { buildTemplateEditorPreviewValues } from "@/lib/templates/preview-values";
import { TEMPLATE_FILE_EXTENSIONS } from "@/lib/templates/file-formats";
import {
  getTemplateOfficePreviewConfig,
  isOfficeNotConfigured,
  type OfficeEditorConfigResponse,
} from "@/lib/api/office.functions";
import { useTemplatePreview } from "../hooks/useTemplatePreview";
import type { Field } from "../types";

interface Props {
  templateId: string;
  filePath: string | null;
  fileFormat: string | null;
  body: string;
  fields: Field[];
  nameRu?: string;
  nameKk?: string;
}

function supportsOfficePreview(format: string | null | undefined): boolean {
  if (!format) return false;
  return (TEMPLATE_FILE_EXTENSIONS as readonly string[]).includes(format.toLowerCase());
}

export function TemplatePreviewCard({
  templateId,
  filePath,
  fileFormat,
  body,
  fields,
  nameRu,
  nameKk,
}: Props) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [fullscreen, setFullscreen] = useState(false);

  const previewValues = useMemo(
    () =>
      buildTemplateEditorPreviewValues(fields, {
        name_ru: nameRu,
        name_kk: nameKk,
      }),
    [fields, nameRu, nameKk],
  );

  const officePreviewEnabled = Boolean(filePath && supportsOfficePreview(fileFormat));
  const officeQueryKey = [
    "office-config",
    "template-preview",
    templateId,
    filePath,
    previewValues,
  ] as const;

  const { data: officeConfig } = useQuery({
    queryKey: officeQueryKey,
    queryFn: () =>
      getTemplateOfficePreviewConfig({
        data: { template_id: templateId, preview_values: previewValues },
      }),
    enabled: officePreviewEnabled,
    staleTime: 60_000,
  });

  const useOfficePreview = officePreviewEnabled && !isOfficeNotConfigured(officeConfig);

  const preview = useTemplatePreview({
    filePath,
    fileFormat,
    body,
    fields,
    nameRu,
    nameKk,
    disabled: useOfficePreview,
  });

  const reloadOfficePreview = () => {
    void queryClient.invalidateQueries({ queryKey: officeQueryKey });
  };

  const hasPreview = useOfficePreview
    ? officeConfig?.available === true
    : preview.mode !== "empty";

  const labels = {
    loading: t("tpl.preview.loading"),
    error: t("tpl.preview.error"),
    empty: t("tpl.preview.empty"),
    unsupported: t("tpl.preview.unsupported"),
  };

  const officeQueryFn = (): Promise<OfficeEditorConfigResponse> =>
    getTemplateOfficePreviewConfig({
      data: { template_id: templateId, preview_values: previewValues },
    });

  const previewContent = useOfficePreview ? (
    <OnlyOfficeEmbed
      editorId={`template-preview-${templateId}`}
      queryKey={officeQueryKey}
      queryFn={officeQueryFn}
      heightClass="min-h-[480px] h-full"
      showPlaceholderWhenUnavailable={false}
    />
  ) : (
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
  );

  const fullscreenContent = useOfficePreview ? (
    <OnlyOfficeEmbed
      editorId={`template-preview-fs-${templateId}`}
      queryKey={officeQueryKey}
      queryFn={officeQueryFn}
      heightClass="min-h-[70vh] h-full"
      showPlaceholderWhenUnavailable={false}
    />
  ) : (
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
  );

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
                onClick={() => (useOfficePreview ? reloadOfficePreview() : preview.reload())}
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
          <p className="mb-3 shrink-0 text-xs text-muted-foreground">
            {useOfficePreview ? t("tpl.preview.officeHint") : t("tpl.preview.hint")}
          </p>
          <div className="flex min-h-0 flex-1 flex-col">{previewContent}</div>
        </CardContent>
      </Card>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t("tpl.preview.title")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            {fullscreen && fullscreenContent}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
