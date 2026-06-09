export interface ReferenceJoin {
  id: string;
  code: string;
  name_ru: string;
  name_kk: string;
  bin?: string;
  color?: string;
  sla_hours?: number | null;
}

export interface Document {
  id: string;
  title_ru: string;
  title_kk: string;
  reg_number: string;
  status: string;
  doc_type: string;
  document_type_id?: string | null;
  priority_id?: string | null;
  correspondent_id?: string | null;
  workflow_id?: string | null;
  custom_route?: unknown;
  ref_document_types?: ReferenceJoin | ReferenceJoin[] | null;
  ref_priorities?: ReferenceJoin | ReferenceJoin[] | null;
  ref_correspondents?: ReferenceJoin | ReferenceJoin[] | null;
  workflows?: {
    name_ru: string;
    name_kk: string;
    definition?: unknown;
  } | null;
  due_at?: string;
  current_version: number;
  body?: string;
  summary?: string;
  sla_status?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  version_no: number;
  comment?: string;
  file_path?: string | null;
  file_format?: string | null;
  body_snapshot?: string | null;
  content_hash?: string | null;
  created_at: string;
}

export interface DocumentComment {
  id: string;
  body: string;
  created_at: string;
  author_id: string; // Исправлено с user_id
  document_id: string; // Добавлено из API
  parent_id: string | null; // Добавлено из API (для цепочек ответов)
}

export interface WorkflowEvent {
  id: string;
  event_type: string;
  node_id?: string;
  created_at: string;
}

export interface WorkflowRun {
  id: string;
  status: string;
  current_node?: string;
  context?: { nodes?: unknown[]; edges?: unknown[] };
  workflows?: {
    name_ru: string;
    name_kk: string;
    definition?: unknown;
  } | null;
}

export interface Task {
  id: string;
  run_id: string;
  title: string;
  node_id: string;
  node_type: string;
  status: string;
  assignee_id: string | null;
  action_required: string;
  due_at: string | null;
  completed_at?: string | null;
  decision?: string | null;
}

export interface SignatureVerificationDetails {
  errors?: string[];
  warnings?: string[];
  cryptoVerified?: boolean;
}

export interface Signature {
  id: string;
  signature_type: string;
  cert_subject?: string;
  signed_at?: string;
  signer_iin?: string | null;
  signer_bin?: string | null;
  cert_valid_to?: string | null;
  cert_fingerprint?: string | null;
  verification_status?: string;
  verified_at?: string | null;
  verification_details?: SignatureVerificationDetails | null;
}

export interface Workflow {
  id: string;
  name_ru: string;
  name_kk: string;
  status: string;
}

export interface DocumentData {
  document: Document;
  versions: DocumentVersion[];
  comments: DocumentComment[];
  events: WorkflowEvent[];
  runs: WorkflowRun[];
  signatures: Signature[];
}
