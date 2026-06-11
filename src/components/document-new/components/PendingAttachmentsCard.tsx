import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Paperclip, Trash2, Upload } from "lucide-react";
import { useI18n } from "@/i18n";
import { formatAttachmentsListText } from "@/lib/documents/attachments-format";

interface PendingAttachmentsCardProps {
  files: File[];
  onChange: (files: File[]) => void;
  onAttachmentsText?: (text: string) => void;
}

export function PendingAttachmentsCard({
  files,
  onChange,
  onAttachmentsText,
}: PendingAttachmentsCardProps) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    const next = [...files, ...incoming];
    onChange(next);
    onAttachmentsText?.(formatAttachmentsListText(next.map((f) => ({ name: f.name }))));
  };

  const removeAt = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    onChange(next);
    onAttachmentsText?.(formatAttachmentsListText(next.map((f) => ({ name: f.name }))));
  };

  return (
    <Card className="rounded-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm">{t("doc.attachments")}</CardTitle>
        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" />
            {t("doc.attachments.add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{t("doc.attachments.createHint")}</p>
        {files.length === 0 ? (
          <div className="flex items-center gap-2 rounded-sm border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            <Paperclip className="h-4 w-4 shrink-0 opacity-50" />
            {t("doc.attachments.empty")}
          </div>
        ) : (
          <ul className="space-y-1">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-2 rounded-sm border border-border px-3 py-2 text-sm"
              >
                <span className="truncate">{file.name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 p-0 text-destructive"
                  onClick={() => removeAt(index)}
                  title={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
