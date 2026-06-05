export interface Document {
  id: string;
  title_ru: string;
  title_kk: string;
  reg_number: string;
  status: string;
  doc_type: string;
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
  created_at: string;
}

export interface DocumentComment {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
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
  workflows?: {
    name_ru: string;
    name_kk: string;
  } | null;
}

export interface Signature {
  id: string;
  signature_type: string;
  cert_subject?: string;
  signed_at?: string;
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