import { z } from "zod";

export const assigneeTypeSchema = z.enum([
  "user",
  "initiator",
  "position",
  "department",
  "department_head",
  "parent_department_head",
  "initiator_manager",
  "role",
  "group",
]);

export const nodeTypeSchema = z.enum([
  "START",
  "APPROVAL",
  "SIGNATURE",
  "TASK",
  "CONDITION",
  "FORK",
  "JOIN",
  "NOTIFICATION",
  "TIMER",
  "ESCALATION",
  "ARCHIVE",
  "END",
]);

export const slaUnitSchema = z.enum(["hours", "business_days"]);

export const nodeConfigSchema = z.object({
  label_kk: z.string().optional(),
  is_required: z.boolean().optional(),
  timeout_action: z.enum(["notify", "reassign", "approve", "reject"]).optional(),
  escalation_role: z.string().nullable().optional(),
  max_escalations: z.number().int().min(1).max(20).optional(),
  sla_repeat_hours: z.number().int().min(1).max(168).optional(),
  parallel_mode: z.enum(["all", "any"]).optional(),
  signature_provider: z.enum(["ncalayer", "egov_qr", "any"]).optional(),
});

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  type: nodeTypeSchema,
  label: z.string().optional(),
  description: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  assignee_id: z.string().nullable().optional(),
  assignee_type: assigneeTypeSchema.optional(),
  assignee_mode: assigneeTypeSchema.optional(),
  assignee_ref: z.string().nullable().optional(),
  sla_hours: z.number().int().min(0).max(8760).optional(),
  sla_unit: slaUnitSchema.optional(),
  sla_working_hours_only: z.boolean().optional(),
  config: nodeConfigSchema.passthrough().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
  condition: z.string().optional(),
});

export const workflowDefinitionSchema = z.object({
  nodes: z.array(workflowNodeSchema).min(2),
  edges: z.array(workflowEdgeSchema),
  schema_version: z.number().int().optional(),
});

export type WorkflowDefinitionInput = z.infer<typeof workflowDefinitionSchema>;

export const WORKFLOW_SCHEMA_VERSION = 2;
