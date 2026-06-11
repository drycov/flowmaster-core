import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { TemplatePreviewPane } from "@/components/shared/TemplatePreviewPane";
import { useDocumentContentPreview } from "../hooks/useDocumentContentPreview";
import type { DocumentFileVersionRow } from "@/lib/documents/file-version";

interface ContentTabProps {
  body?: string | null;
  fieldValues?: Record<string, string>;
  fileVersion?: DocumentFileVersionRow | null;
  summary?: string;
  isEditable?: boolean;
  onSave?: (content: string) => Promise<void>;
}

export function ContentTab({
  body = "",
  fieldValues = {},
  fileVersion,
  summary,
  isEditable = false,
  onSave,
}: ContentTabProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(body ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const preview = useDocumentContentPreview({
    body,
    fieldValues,
    fileVersion,
  });

  const labels = {
    loading: t("doc.preview.loading"),
    error: t("doc.preview.error"),
    empty: t("doc.preview.empty"),
    unsupported: t("tpl.preview.unsupported"),
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(editedBody);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedBody(body ?? "");
    setIsEditing(false);
  };

  const handleStartEditing = () => {
    setEditedBody(body ?? "");
    setIsEditing(true);
  };

  return (
    <Card className="rounded-sm">
      <CardContent className="p-6">
        {isEditable && !isEditing && !fileVersion?.file_path && (
          <div className="flex justify-end mb-4">
            <Button size="sm" variant="outline" onClick={handleStartEditing}>
              <Pencil className="w-4 h-4 mr-1" />
              {t("doc.edit")}
            </Button>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              rows={15}
              className="font-mono text-sm"
              placeholder={t("doc.contentPlaceholder")}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-1" />
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-1" />
                {isSaving ? t("doc.saving") : t("doc.save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {summary && <p className="text-muted-foreground italic">{summary}</p>}
            <div className="min-h-[320px]">
              <TemplatePreviewPane
                status={preview.status}
                error={preview.error}
                html={preview.html}
                mode={preview.mode}
                docxBlob={preview.docxBlob}
                fill
                labels={labels}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
