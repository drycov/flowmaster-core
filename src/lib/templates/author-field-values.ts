/** Keys filled at document generation (registration number, date, title). */
export const SYSTEM_TEMPLATE_FIELD_KEYS = [
  "document_number",
  "document_date",
  "registration_number",
  "reg_number",
  "document_title",
  "title_ru",
  "title_kk",
] as const;

/** Keys filled from organization settings. */
export const ORGANIZATION_FIELD_KEYS = ["organization_name"] as const;

/** Keys filled from the document author profile (executor block). */
export const AUTHOR_EXECUTOR_FIELD_KEYS = [
  "executor_name",
  "executor_position",
  "executor_phone",
  "executor",
  "исполнитель",
  "ispolnitel",
] as const;

/** Keys filled from signatory (department/direction head) — sender block in memos. */
export const AUTHOR_SENDER_FIELD_KEYS = [
  "sender_name",
  "sender_position",
  "sender_short_name",
  "sender",
] as const;

/** Keys filled from author or department/direction head. */
export const AUTHOR_SIGNATORY_FIELD_KEYS = [
  "signatory_line",
  "signatory",
  "подписант",
  "podpisant",
] as const;

/** Name-only signature fields (without position prefix). */
export const AUTHOR_SIGNATURE_NAME_FIELD_KEYS = ["signature_name", "signature"] as const;

export type AuthorProfileSource = {
  id?: string;
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  email?: string | null;
  position_label?: string | null;
  department_label?: string | null;
  department_id?: string | null;
  phone?: string | null;
  positions?: { title_ru?: string | null; title_kk?: string | null } | null;
  position_ru?: string | null;
  departments?: { name_ru?: string | null; name_kk?: string | null } | null;
};

export type DepartmentHeadSource = {
  head_user_id?: string | null;
  parent_id?: string | null;
};

export type OrganizationSource = {
  name_ru?: string | null;
  name_kk?: string | null;
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

/** «Иванов И.И.» from «Иванов Иван Иванович». */
export function formatShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const surname = parts[0];
  const initials = parts
    .slice(1)
    .map((part) => {
      const ch = part[0];
      return ch ? `${ch.toUpperCase()}.` : "";
    })
    .join("");
  return `${surname} ${initials}`.trim();
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

export function buildOrganizationTemplateDefaults(
  organization: OrganizationSource | null | undefined,
): Record<string, string> {
  const values: Record<string, string> = {};
  const name = (organization?.name_ru || organization?.name_kk || "").trim();
  if (name) {
    for (const key of ORGANIZATION_FIELD_KEYS) {
      values[key] = name;
    }
  }
  return values;
}

function departmentName(profile: AuthorProfileSource): string {
  return (
    profile.departments?.name_ru?.trim() ||
    profile.departments?.name_kk?.trim() ||
    profile.department_label?.split("/")[0]?.trim() ||
    ""
  );
}

export function buildProfilePresetDefaults(
  profile: AuthorProfileSource | null | undefined,
): Record<string, string> {
  const values: Record<string, string> = {};
  if (!profile) return values;

  const name = displayName(profile);
  const dept = departmentName(profile);
  const position = positionTitle(profile);
  const phone = (profile.phone ?? "").trim();
  const email = (profile.email ?? "").trim();

  if (name) {
    values.full_name = name;
    values.fio = name;
    values.responsible_person = name;
  }
  if (dept) values.department = dept;
  if (position) values.position = position;
  if (phone) values.phone = phone;
  if (email) values.email = email;

  return values;
}

export function buildAuthorTemplateDefaults(
  profile: AuthorProfileSource | null | undefined,
  signatoryProfile?: AuthorProfileSource | null,
): Record<string, string> {
  const values: Record<string, string> = {
    ...buildProfilePresetDefaults(profile),
  };

  const authorName = profile ? displayName(profile) : "";
  const authorPosition = profile ? positionTitle(profile) : "";
  const authorPhone = (profile?.phone ?? "").trim();

  if (authorName) {
    for (const key of AUTHOR_EXECUTOR_FIELD_KEYS) {
      if (key === "executor_position") {
        if (authorPosition) values[key] = authorPosition;
      } else if (key === "executor_phone") {
        if (authorPhone) values[key] = authorPhone;
      } else {
        values[key] = authorName;
      }
    }
  } else if (authorPosition) {
    values.executor_position = authorPosition;
  }
  if (authorPhone && !values.executor_phone) {
    values.executor_phone = authorPhone;
  }

  const signer = signatoryProfile ?? profile;
  if (!signer) return values;

  const signatoryLine = formatSignatoryLine(signer);
  const signatoryName = displayName(signer);
  const signatoryPosition = positionTitle(signer);
  const signatoryShort = signatoryName ? formatShortName(signatoryName) : "";

  if (signatoryName) {
    for (const key of AUTHOR_SENDER_FIELD_KEYS) {
      if (key === "sender_position") {
        if (signatoryPosition) values[key] = signatoryPosition;
      } else if (key === "sender_short_name") {
        if (signatoryShort) values[key] = signatoryShort;
      } else {
        values[key] = signatoryName;
      }
    }
  } else if (signatoryPosition) {
    values.sender_position = signatoryPosition;
  }

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

export function isSystemTemplateField(key: string): boolean {
  return (SYSTEM_TEMPLATE_FIELD_KEYS as readonly string[]).includes(key);
}

export function isOrganizationField(key: string): boolean {
  return (ORGANIZATION_FIELD_KEYS as readonly string[]).includes(key);
}

export function isAuthorExecutorField(key: string): boolean {
  return (AUTHOR_EXECUTOR_FIELD_KEYS as readonly string[]).includes(key);
}

export function isAuthorSenderField(key: string): boolean {
  return (AUTHOR_SENDER_FIELD_KEYS as readonly string[]).includes(key);
}

export function isAuthorSignatoryField(key: string): boolean {
  return (
    (AUTHOR_SIGNATORY_FIELD_KEYS as readonly string[]).includes(key) ||
    (AUTHOR_SIGNATURE_NAME_FIELD_KEYS as readonly string[]).includes(key)
  );
}

/** @deprecated Use isAuthorExecutorField / isAuthorSignatoryField / isAuthorSenderField */
export function isAutoAuthorField(key: string): boolean {
  return (
    isAuthorExecutorField(key) ||
    isAuthorSenderField(key) ||
    isAuthorSignatoryField(key) ||
    isOrganizationField(key) ||
    isSystemTemplateField(key)
  );
}
