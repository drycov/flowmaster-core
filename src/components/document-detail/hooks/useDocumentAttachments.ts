import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { getSignedDownloadUrl } from "@/lib/api/storage.functions";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import { uploadDocumentAttachments } from "@/lib/documents/upload-attachments";
import {
  deleteDocumentAttachment,
  listDocumentAttachments,
} from "@/lib/api/document-attachments.functions";

export type DocumentAttachmentRow = {
  id: string;
  document_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  sort_order: number;
  created_at: string;
  created_by: string;
};

export function useDocumentAttachments(documentId: string) {
  return useQuery({
    queryKey: ["document-attachments", documentId],
    queryFn: () =>
      listDocumentAttachments({ data: { document_id: documentId } }) as Promise<
        DocumentAttachmentRow[]
      >,
  });
}

export function useDocumentAttachmentUpload(documentId: string) {
  const qc = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (files: File[]) => {
      const existing = (qc.getQueryData(["document-attachments", documentId]) ??
        []) as DocumentAttachmentRow[];
      await uploadDocumentAttachments(documentId, files, existing.length);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-attachments", documentId] });
      toast.success(t("doc.attachments.uploaded"));
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t("doc.attachments.error"));
    },
  });
}

export function useDocumentAttachmentDelete(documentId: string) {
  const qc = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: (id: string) => deleteDocumentAttachment({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-attachments", documentId] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : t("doc.attachments.error"));
    },
  });
}

export async function downloadDocumentAttachment(filePath: string) {
  const { signed_url } = await getSignedDownloadUrl({
    data: {
      bucket: STORAGE_BUCKETS.documents,
      path: filePath,
    },
  });
  window.open(signed_url, "_blank", "noopener,noreferrer");
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export { formatFileSize };
