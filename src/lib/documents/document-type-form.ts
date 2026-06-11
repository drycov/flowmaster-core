/** Metadata fields on the document creation / edit form (excluding title/body). */
export type DocumentMetadataField =
  | "nomenclature_id"
  | "priority_id"
  | "correspondent_id"
  | "registration_journal_id"
  | "delivery_method_id"
  | "external_reg_number"
  | "pages_count"
  | "copies_count"
  | "received_at"
  | "sent_at";

export type DocumentTypeFormProfile = {
  visible: DocumentMetadataField[];
  required: DocumentMetadataField[];
};

const BASE: DocumentMetadataField[] = [
  "nomenclature_id",
  "priority_id",
  "registration_journal_id",
];

const CORRESPONDENCE_COMMON: DocumentMetadataField[] = [
  "correspondent_id",
  "delivery_method_id",
  "pages_count",
  "copies_count",
];

const PROFILES: Record<string, DocumentTypeFormProfile> = {
  incoming: {
    visible: [
      ...BASE,
      ...CORRESPONDENCE_COMMON,
      "external_reg_number",
      "received_at",
    ],
    required: ["correspondent_id", "received_at"],
  },
  outgoing: {
    visible: [...BASE, ...CORRESPONDENCE_COMMON, "external_reg_number", "sent_at"],
    required: ["correspondent_id", "sent_at"],
  },
  contract: {
    visible: [...BASE, "correspondent_id", "external_reg_number"],
    required: ["correspondent_id"],
  },
  internal: {
    visible: [...BASE],
    required: [],
  },
};

const INTERNAL_LIKE_CODES = new Set([
  "internal",
  "order",
  "memo",
  "protocol",
  "act",
  "application",
  "report",
]);

const DEFAULT_INTERNAL_PROFILE = PROFILES.internal;

const EMPTY_PROFILE: DocumentTypeFormProfile = {
  visible: ["nomenclature_id", "priority_id"],
  required: [],
};

export function getDocumentTypeFormProfile(
  typeCode: string | null | undefined,
): DocumentTypeFormProfile {
  if (!typeCode) return EMPTY_PROFILE;
  if (PROFILES[typeCode]) return PROFILES[typeCode];
  if (INTERNAL_LIKE_CODES.has(typeCode)) return DEFAULT_INTERNAL_PROFILE;
  return DEFAULT_INTERNAL_PROFILE;
}

export function isMetadataFieldVisible(
  profile: DocumentTypeFormProfile,
  field: DocumentMetadataField,
): boolean {
  return profile.visible.includes(field);
}

export function isMetadataFieldRequired(
  profile: DocumentTypeFormProfile,
  field: DocumentMetadataField,
): boolean {
  return profile.required.includes(field);
}

export function hasCorrespondenceSection(profile: DocumentTypeFormProfile): boolean {
  return (
    isMetadataFieldVisible(profile, "correspondent_id") ||
    isMetadataFieldVisible(profile, "external_reg_number") ||
    isMetadataFieldVisible(profile, "received_at") ||
    isMetadataFieldVisible(profile, "sent_at") ||
    isMetadataFieldVisible(profile, "delivery_method_id") ||
    isMetadataFieldVisible(profile, "pages_count") ||
    isMetadataFieldVisible(profile, "copies_count")
  );
}

export type ReferenceBriefLike = { id: string; code: string };

export function resolveDocumentTypeCode(
  documentTypeId: string | null | undefined,
  documentTypes: ReferenceBriefLike[],
): string | null {
  if (!documentTypeId) return null;
  return documentTypes.find((dt) => dt.id === documentTypeId)?.code ?? null;
}

export function validateDocumentFormByType(
  values: Record<string, string | undefined>,
  profile: DocumentTypeFormProfile,
  labels: Partial<Record<DocumentMetadataField, string>>,
): string | null {
  for (const field of profile.required) {
    const raw = values[field]?.trim?.() ?? values[field];
    if (!raw) {
      return labels[field] ?? field;
    }
  }
  return null;
}

/** Clear values hidden after document type change. */
export function hiddenMetadataFields(
  profile: DocumentTypeFormProfile,
): DocumentMetadataField[] {
  const all: DocumentMetadataField[] = [
    "nomenclature_id",
    "priority_id",
    "correspondent_id",
    "registration_journal_id",
    "delivery_method_id",
    "external_reg_number",
    "pages_count",
    "copies_count",
    "received_at",
    "sent_at",
  ];
  return all.filter((f) => !isMetadataFieldVisible(profile, f));
}
