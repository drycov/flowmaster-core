/** Stable IDs for seeded HR leave workflow + templates (migration 20260617210000). */
export const HR_LEAVE_WORKFLOW_ID = "a1b2c3d4-e5f6-4789-a012-000000000001";

export const HR_LEAVE_TPL_APPLICATION = "a1b2c3d4-e5f6-4789-a012-000000000101";
export const HR_LEAVE_TPL_ORDER = "a1b2c3d4-e5f6-4789-a012-000000000102";
export const HR_LEAVE_TPL_MEMO = "a1b2c3d4-e5f6-4789-a012-000000000103";

export const HR_LEAVE_DOC_KINDS = ["application", "approval_sheet", "order", "memo"] as const;
export type HrLeaveDocKind = (typeof HR_LEAVE_DOC_KINDS)[number];

export const HR_LEAVE_ROLE_CODE = "hr_officer";
