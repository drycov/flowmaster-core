import { z } from "zod";

export const customRouteStepSchema = z.object({
  order: z.number().int().min(0),
  label: z.string().max(255).optional(),
  assignee_user_id: z.string().uuid().nullable().optional(),
  assignee_position_id: z.string().uuid().nullable().optional(),
  assignee_department_id: z.string().uuid().nullable().optional(),
  assignee_mode: z.enum(["user", "position", "department_head", "role"]).default("user"),
  assignee_role: z.string().max(64).nullable().optional(),
  sla_hours: z.number().int().min(0).max(8760).default(72),
  action: z.enum(["approve", "sign", "review"]).default("approve"),
});

export const graphDefinitionSchema = z.object({
  kind: z.literal("graph").optional(),
  nodes: z.array(z.record(z.string(), z.unknown())),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      label: z.string().optional(),
      condition: z.string().optional(),
    }),
  ),
  schema_version: z.number().int().optional(),
});

export const customRouteSchema = z
  .union([z.array(customRouteStepSchema), graphDefinitionSchema])
  .nullable()
  .optional();
