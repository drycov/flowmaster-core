/** Barrel re-exports — implementation split by domain. */
export { listDocuments, getDocument, getDashboardStats } from "./documents-query.functions";

export {
  createDocument,
  updateDocumentMetadata,
  addComment,
  updateDocumentStatus,
} from "./documents-mutation.functions";

export { addSignature } from "./documents-signatures.functions";
