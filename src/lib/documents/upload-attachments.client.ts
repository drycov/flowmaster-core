import { uploadAuthenticatedFile } from "@/lib/storage/client";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import {
  prepareDocumentAttachmentUpload,
  registerDocumentAttachment,
} from "@/lib/api/document-attachments.functions";

export async function uploadDocumentAttachments(
  documentId: string,
  files: File[],
  startSortOrder = 0,
): Promise<void> {
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const plan = await prepareDocumentAttachmentUpload({
      data: {
        document_id: documentId,
        filename: file.name,
        file_size: file.size,
        mime_type: file.type || null,
      },
    });

    await uploadAuthenticatedFile(STORAGE_BUCKETS.documents, plan.storage_path, file);

    await registerDocumentAttachment({
      data: {
        document_id: documentId,
        attachment_id: plan.attachment_id,
        storage_path: plan.storage_path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        sort_order: startSortOrder + index,
      },
    });
  }
}
