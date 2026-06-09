// src/components/document-detail/components/ContentTab.tsx
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X } from "lucide-react";
import { useI18n } from "@/i18n";

interface ContentTabProps {
  body?: string;
  summary?: string;
  isEditable?: boolean;
  onSave?: (content: string) => Promise<void>;
}

export function ContentTab({ body, summary, isEditable = false, onSave }: ContentTabProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(body || "");
  const [isSaving, setIsSaving] = useState(false);

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
    setEditedBody(body || "");
    setIsEditing(false);
  };

  return (
    <Card className="rounded-sm">
      <CardContent className="p-6">
        {isEditable && !isEditing && (
          <div className="flex justify-end mb-4">
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
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
          <>
            {summary && (
              <p className="text-muted-foreground italic mb-4">{summary}</p>
            )}
            <div className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-sm">
              {body || <span className="text-muted-foreground">{t("common.empty")}</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}