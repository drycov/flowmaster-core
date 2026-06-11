/** Barrel re-exports — implementation split by domain. */
export {
  listDocuments,
  getDocument,
  getDashboardStats,
  type DocumentListRowEnriched,
} from "./documents-query.functions";

export {
  createDocument,
  updateDocumentMetadata,
  addComment,
  updateDocumentStatus,
  type CreateDocumentResult,
} from "./documents-mutation.functions";

export { addSignature } from "./documents-signatures.functions";
