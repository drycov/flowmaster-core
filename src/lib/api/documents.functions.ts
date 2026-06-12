/** Barrel re-exports — implementation in `./documents/`. */
export {
  listDocuments,
  getDocument,
  getDashboardStats,
  type DocumentListRowEnriched,
} from "./documents/query.functions";

export {
  createDocument,
  updateDocumentMetadata,
  addComment,
  updateDocumentStatus,
  type CreateDocumentResult,
} from "./documents/mutation.functions";

export { addSignature } from "./documents/signatures.functions";

export {
  cancelEgovQrSigning,
  completeEgovQrSigning,
  getEgovQrSigningAvailability,
  sendEgovQrSigningData,
  startEgovQrSigning,
} from "./documents/egov-qr.functions";
