import { createIsomorphicFn } from "@tanstack/react-start";

/** Upload pending files after document creation (browser only). */
export const uploadDocumentAttachments = createIsomorphicFn()
  .server(async (_documentId: string, _files: File[], _startSortOrder = 0) => {
    // No-op on server — mutation runs in the browser after createDocument.
  })
  .client(async (documentId: string, files: File[], startSortOrder = 0) => {
    const { uploadDocumentAttachments: impl } = await import("./upload-attachments.client");
    await impl(documentId, files, startSortOrder);
  });
