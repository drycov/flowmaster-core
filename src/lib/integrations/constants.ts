export const API_KEY_SCOPES = [
  "documents:read",
  "documents:write",
  "tasks:read",
  "tasks:write",
  "import:write",
  "contracts:read",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const WEBHOOK_EVENTS = [
  "task.created",
  "task.completed",
  "document.created",
  "document.signed",
  "document.status_changed",
  "document.archived",
  "import.completed",
  "workflow.started",
  "workflow.completed",
] as const;

/** Events currently emitted by database triggers */
export const WEBHOOK_EVENTS_ACTIVE = [
  "task.created",
  "document.signed",
  "document.status_changed",
] as const;
