import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { fmtDate } from "@/lib/format";
import { Download, Loader2, Upload } from "lucide-react";
import type { DocumentVersion } from "../types";
import { useDocumentVersionUpload } from "../hooks/useDocumentVersionUpload";
import { VersionDiffPanel } from "./VersionDiffPanel";
import { getSignedDownloadUrl } from "@/lib/api/storage.functions";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";

interface VersionsTabProps {
  documentId: string;
  versions: DocumentVersion[];
  canUpload?: boolean;
}

export function VersionsTab({ documentId, versions, canUpload = true }: VersionsTabProps) {
  const { locale, t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [comment, setComment] = useState("");
  const upload = useDocumentVersionUpload(documentId);

  const handleDownload = async (filePath: string) => {
    try {
      const { signed_url } = await getSignedDownloadUrl({
        data: {
          bucket: STORAGE_BUCKETS.documents,
          path: filePath,
        },
      });
      window.open(signed_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Card className="rounded-sm">
      {canUpload && (
        <div className="flex flex-wrap items-end gap-2 border-b border-border p-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder={t("common.comment")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={upload.isPending}
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                upload.mutate({ file, comment: comment || undefined });
                e.target.value = "";
              }
            }}
          />
          <Button size="sm" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
            {upload.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1" />
            )}
            {t("doc.upload_version")}
          </Button>
        </div>
      )}
      <CardContent className="p-0">
        <table className="w-full data-table">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2 w-20">#</th>
              <th className="text-left px-4 py-2">{t("common.comment")}</th>
              <th className="text-left px-4 py-2 w-24">Файл</th>
              <th className="text-left px-4 py-2 w-40">{t("common.date")}</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  {t("common.empty")}
                </td>
              </tr>
            ) : (
              versions.map((v) => (
                <tr key={v.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono">v{v.version_no}</td>
                  <td className="px-4 py-2">{v.comment || "—"}</td>
                  <td className="px-4 py-2">
                    {v.file_path ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleDownload(v.file_path!)}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        {v.file_format ?? "file"}
                      </Button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {fmtDate(v.created_at, locale)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <VersionDiffPanel versions={versions} />
      </CardContent>
    </Card>
  );
}
