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
  file_path?: string | null;
  file_format?: string | null;
  created_at: string;
}

export interface DocumentComment {
  id: string;
  body: string;
  created_at: string;
  author_id: string;       // Исправлено с user_id
  document_id: string;     // Добавлено из API
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
  workflows?: {
    name_ru: string;
    name_kk: string;
    definition?: any; // Сюда конструктор (React Flow) складывает { nodes: [...], edges: [...] }
  } | null;
}

export interface Task {
  id: string;
  title: string;
  node_id: string;
  node_type: string;
  status: string;
  assignee_id: string | null;
  action_required: string;
  due_at: string | null;
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