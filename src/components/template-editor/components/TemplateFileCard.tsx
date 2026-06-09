import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileSearch, Loader2, Upload } from "lucide-react";
import { useI18n } from "@/i18n";
import { useTemplateFileUpload } from "../hooks/useTemplateFileUpload";
import { useTemplateFileScan } from "../hooks/useTemplateFileScan";
import { getSignedDownloadUrl } from "@/lib/api/storage.functions";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import {
  formatLabel,
  supportsTemplateProcessing,
  TEMPLATE_FILE_EXTENSIONS,
} from "@/lib/templates/file-formats";
import type { TemplateSyncResult } from "../types";

interface Props {
  templateId: string;
  filePath?: string | null;
  fileFormat?: string | null;
  onSynced?: (result: TemplateSyncResult) => void;
}

export function TemplateFileCard({
  templateId,
  filePath,
  fileFormat,
  onSynced,
}: Props) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useTemplateFileUpload(templateId, onSynced);
  const scan = useTemplateFileScan(templateId, onSynced);

  const accept = TEMPLATE_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(",");
  const canScan = Boolean(filePath && supportsTemplateProcessing(fileFormat));
  const isLegacy = Boolean(fileFormat && !supportsTemplateProcessing(fileFormat));

  const handleDownload = async () => {
    if (!filePath) return;
    const { signed_url } = await getSignedDownloadUrl({
      data: { bucket: STORAGE_BUCKETS.templates, path: filePath },
    });
    window.open(signed_url, "_blank", "noopener,noreferrer");
  };

  const handleScan = () => {
    scan.mutate();
  };

  return (
    <Card className="rounded-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">{t("tpl.fileTemplate.title")}</CardTitle>
        {fileFormat && (
          <Badge variant="secondary" className="text-xs">
            {formatLabel(fileFormat)}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t("tpl.fileTemplate.hint")}</p>

        {filePath && (
          <p className="text-xs text-muted-foreground break-all">{filePath}</p>
        )}

        {isLegacy && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
            {t("tpl.fileTemplate.legacyHint")}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                upload.mutate(file);
                e.target.value = "";
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={upload.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {upload.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1" />
            )}
            {t("tpl.fileTemplate.upload")}
          </Button>

          {filePath && (
            <Button size="sm" variant="ghost" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-1" />
              {t("tpl.download")}
            </Button>
          )}

          {canScan && (
            <Button
              size="sm"
              variant="secondary"
              disabled={scan.isPending}
              onClick={handleScan}
            >
              {scan.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <FileSearch className="w-4 h-4 mr-1" />
              )}
              {t("tpl.fileTemplate.extractFields")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
