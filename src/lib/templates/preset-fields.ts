/** Единый каталог предустановленных плейсхолдеров шаблона (редактор + автоподстановка). */
export type TemplatePresetSource =
  | "system"
  | "organization"
  | "author"
  | "signatory"
  | "user";

export type TemplatePresetFieldDef = {
  key: string;
  labelKey: string;
  source: TemplatePresetSource;
};

/** Поля из меню «Предустановленные поля» — базовый набор. */
export const TEMPLATE_BODY_PRESETS: TemplatePresetFieldDef[] = [
  { key: "full_name", labelKey: "tpl.preset.fullName", source: "author" },
  { key: "document_date", labelKey: "tpl.preset.documentDate", source: "system" },
  { key: "department", labelKey: "tpl.preset.department", source: "author" },
  { key: "registration_number", labelKey: "tpl.preset.regNumber", source: "system" },
  { key: "document_title", labelKey: "tpl.preset.documentTitle", source: "system" },
  { key: "responsible_person", labelKey: "tpl.preset.responsible", source: "author" },
  { key: "signature_name", labelKey: "tpl.preset.signature", source: "signatory" },
  { key: "content_body", labelKey: "tpl.preset.content", source: "user" },
];

/** Дополнительные системные и профильные ключи (DOCX / расширенные шаблоны). */
export const TEMPLATE_EXTENDED_PRESETS: TemplatePresetFieldDef[] = [
  { key: "organization_name", labelKey: "tpl.preset.organization", source: "organization" },
  { key: "document_number", labelKey: "tpl.preset.documentNumber", source: "system" },
  { key: "position", labelKey: "tpl.preset.position", source: "author" },
  { key: "phone", labelKey: "tpl.preset.phone", source: "author" },
  { key: "executor_name", labelKey: "tpl.preset.executorName", source: "author" },
  { key: "executor_position", labelKey: "tpl.preset.executorPosition", source: "author" },
  { key: "executor_phone", labelKey: "tpl.preset.executorPhone", source: "author" },
  { key: "sender_name", labelKey: "tpl.preset.senderName", source: "signatory" },
  { key: "sender_position", labelKey: "tpl.preset.senderPosition", source: "signatory" },
  { key: "sender_short_name", labelKey: "tpl.preset.senderShortName", source: "signatory" },
  { key: "signatory_line", labelKey: "tpl.preset.signatoryLine", source: "signatory" },
  { key: "attachments", labelKey: "tpl.preset.attachments", source: "user" },
  { key: "document_subject", labelKey: "tpl.preset.documentSubject", source: "user" },
];

export const ALL_TEMPLATE_PRESET_KEYS = new Set(
  [...TEMPLATE_BODY_PRESETS, ...TEMPLATE_EXTENDED_PRESETS].map((field) => field.key),
);

/** Синхронизация алиасов перед подстановкой в DOCX/HTML. */
export function harmonizeTemplateSubstitutionValues(
  values: Record<string, string>,
  options?: { body?: string | null; summary?: string | null },
): Record<string, string> {
  const out = { ...values };

  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const v = out[key]?.trim();
      if (v) return v;
    }
    return "";
  };

  const fullName = pick("full_name", "executor_name", "fio", "responsible_person");
  if (fullName && !out.full_name) out.full_name = fullName;
  if (fullName && !out.executor_name) out.executor_name = fullName;
  if (fullName && !out.responsible_person) out.responsible_person = fullName;

  const reg = pick("registration_number", "reg_number", "document_number");
  if (reg) {
    out.registration_number = reg;
    out.reg_number = reg;
    out.document_number = reg;
  }

  const title = pick("document_title", "title_ru", "title");
  if (title) {
    out.document_title = title;
    if (!out.title_ru) out.title_ru = title;
  }

  const subject = pick("document_subject", "document_title", "title_ru");
  if (subject && !out.document_subject) out.document_subject = subject;

  const content = pick("content_body", "body", "content", "summary");
  if (content) {
    out.content_body = content;
  } else if (options?.body?.trim()) {
    out.content_body = options.body.trim();
  } else if (options?.summary?.trim()) {
    out.content_body = options.summary.trim();
  }

  const signature = pick("signature_name", "signature", "sender_short_name");
  if (signature && !out.signature_name) out.signature_name = signature;

  return out;
}
