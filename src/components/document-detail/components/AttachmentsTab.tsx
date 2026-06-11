import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useI18n } from "@/i18n";
import { fmtDateShort } from "@/lib/format";
import {
  downloadDocumentAttachment,
  formatFileSize,
  useDocumentAttachmentDelete,
  useDocumentAttachmentUpload,
  useDocumentAttachments,
} from "../hooks/useDocumentAttachments";

interface AttachmentsTabProps {
  documentId: string;
  canUpload?: boolean;
}

export function AttachmentsTab({ documentId, canUpload = true }: AttachmentsTabProps) {
  const { t, locale } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: attachments = [], isLoading } = useDocumentAttachments(documentId);
  const upload = useDocumentAttachmentUpload(documentId);
  const remove = useDocumentAttachmentDelete(documentId);

  return (
    <Card className="rounded-sm">
      {canUpload && (
        <div className="flex items-center gap-2 border-b border-border p-4">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) {
                upload.mutate(files);
                e.target.value = "";
              }
            }}
          />
          <Button
            size="sm"
            disabled={upload.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {upload.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1 h-4 w-4" />
            )}
            {t("doc.attachments.add")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("doc.attachments.hint")}</p>
        </div>
      )}

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : attachments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-sm text-muted-foreground">
            <Paperclip className="h-8 w-8 opacity-40" />
            {t("doc.attachments.empty")}
          </div>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>{t("doc.attachments.file")}</th>
                <th>{t("doc.attachments.size")}</th>
                <th>{t("common.date")}</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {attachments.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.file_name}</td>
                  <td>{formatFileSize(row.file_size)}</td>
                  <td>{fmtDateShort(row.created_at, locale)}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => downloadDocumentAttachment(row.file_path)}
                        title={t("doc.attachments.download")}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canUpload && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(row.id)}
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
