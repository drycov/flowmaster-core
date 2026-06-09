/** Keys filled from the document author profile. */
export const AUTHOR_EXECUTOR_FIELD_KEYS = [
  "executor_name",
  "executor",
  "исполнитель",
  "ispolnitel",
] as const;

/** Keys filled from author or department/direction head. */
export const AUTHOR_SIGNATORY_FIELD_KEYS = [
  "signatory_line",
  "signatory",
  "подписант",
  "podpisant",
] as const;

/** Name-only signature fields (without position prefix). */
export const AUTHOR_SIGNATURE_NAME_FIELD_KEYS = [
  "signature_name",
  "signature",
] as const;

export type AuthorProfileSource = {
  id?: string;
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  position_label?: string | null;
  department_label?: string | null;
  department_id?: string | null;
  positions?: { title_ru?: string | null; title_kk?: string | null } | null;
  position_ru?: string | null;
};

export type DepartmentHeadSource = {
  head_user_id?: string | null;
  parent_id?: string | null;
};

function displayName(profile: AuthorProfileSource): string {
  return (profile.full_name_ru || profile.full_name_kk || "").trim();
}

function positionTitle(profile: AuthorProfileSource): string {
  return (
    profile.positions?.title_ru ||
    profile.position_ru ||
    profile.position_label?.split("/")[0]?.trim() ||
    ""
  ).trim();
}

export function formatSignatoryLine(profile: AuthorProfileSource): string {
  const name = displayName(profile);
  const position = positionTitle(profile);
  if (position && name) return `${position} ${name}`;
  return name || position;
}

/**
 * Подписант: сам автор, если он руководитель подразделения/направления;
 * иначе — руководитель подразделения, затем направления (parent).
 */
export function resolveSignatoryUserId(
  authorId: string,
  department: DepartmentHeadSource | null | undefined,
  parentDepartment: DepartmentHeadSource | null | undefined,
  managerUserId?: string | null,
): string {
  if (department?.head_user_id === authorId) return authorId;
  if (parentDepartment?.head_user_id === authorId) return authorId;

  if (department?.head_user_id) return department.head_user_id;
  if (parentDepartment?.head_user_id) return parentDepartment.head_user_id;
  if (managerUserId) return managerUserId;

  return authorId;
}

export function buildAuthorTemplateDefaults(
  profile: AuthorProfileSource | null | undefined,
  signatoryProfile?: AuthorProfileSource | null,
): Record<string, string> {
  const values: Record<string, string> = {};

  const authorName = profile ? displayName(profile) : "";
  if (authorName) {
    for (const key of AUTHOR_EXECUTOR_FIELD_KEYS) {
      values[key] = authorName;
    }
  }

  const signer = signatoryProfile ?? profile;
  if (!signer) return values;

  const signatoryLine = formatSignatoryLine(signer);
  const signatoryName = displayName(signer);

  if (signatoryLine) {
    for (const key of AUTHOR_SIGNATORY_FIELD_KEYS) {
      values[key] = signatoryLine;
    }
  }
  if (signatoryName) {
    for (const key of AUTHOR_SIGNATURE_NAME_FIELD_KEYS) {
      values[key] = signatoryName;
    }
  }

  return values;
}

export function isAuthorExecutorField(key: string): boolean {
  return (AUTHOR_EXECUTOR_FIELD_KEYS as readonly string[]).includes(key);
}

export function isAuthorSignatoryField(key: string): boolean {
  return (
    (AUTHOR_SIGNATORY_FIELD_KEYS as readonly string[]).includes(key) ||
    (AUTHOR_SIGNATURE_NAME_FIELD_KEYS as readonly string[]).includes(key)
  );
}
