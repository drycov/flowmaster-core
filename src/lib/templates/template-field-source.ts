import {
  AUTHOR_EXECUTOR_FIELD_KEYS,
  AUTHOR_SENDER_FIELD_KEYS,
  AUTHOR_SIGNATORY_FIELD_KEYS,
  AUTHOR_SIGNATURE_NAME_FIELD_KEYS,
  ORGANIZATION_FIELD_KEYS,
  SYSTEM_TEMPLATE_FIELD_KEYS,
  isAuthorExecutorField,
  isAuthorSenderField,
  isAuthorSignatoryField,
  isOrganizationField,
  isSystemTemplateField,
} from "./author-field-values";

export type TemplateFieldSource =
  | "user"
  | "author"
  | "signatory"
  | "organization"
  | "system";

export type TemplateFieldLike = {
  key: string;
  source?: TemplateFieldSource;
};

export function resolveTemplateFieldSource(field: TemplateFieldLike): TemplateFieldSource {
  if (field.source) return field.source;
  const key = field.key;
  if (isSystemTemplateField(key)) return "system";
  if (isOrganizationField(key)) return "organization";
  if (isAuthorExecutorField(key)) return "author";
  if (isAuthorSenderField(key) || isAuthorSignatoryField(key) || isAuthorSignatureNameKey(key)) {
    return "signatory";
  }
  return "user";
}

function isAuthorSignatureNameKey(key: string): boolean {
  return (AUTHOR_SIGNATURE_NAME_FIELD_KEYS as readonly string[]).includes(key);
}

export function isAutoFilledTemplateField(field: TemplateFieldLike): boolean {
  return resolveTemplateFieldSource(field) !== "user";
}

export function userEditableTemplateFields<T extends TemplateFieldLike>(fields: T[]): T[] {
  return fields.filter((field) => !isAutoFilledTemplateField(field));
}

export {
  AUTHOR_EXECUTOR_FIELD_KEYS,
  AUTHOR_SENDER_FIELD_KEYS,
  AUTHOR_SIGNATORY_FIELD_KEYS,
  ORGANIZATION_FIELD_KEYS,
  SYSTEM_TEMPLATE_FIELD_KEYS,
};
