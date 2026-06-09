import type { TemplateFieldDef } from "./file-formats";

type FieldPreset = Omit<TemplateFieldDef, "key">;

const PRESET_FIELDS: Record<string, FieldPreset> = {
  full_name: {
    label_ru: "ФИО сотрудника",
    label_kk: "Қызметкердің аты-жөні",
    type: "text",
    required: true,
  },
  fio: {
    label_ru: "ФИО",
    label_kk: "Аты-жөні",
    type: "text",
    required: true,
  },
  employee_name: {
    label_ru: "ФИО сотрудника",
    label_kk: "Қызметкердің аты-жөні",
    type: "text",
  },
  document_date: {
    label_ru: "Дата документа",
    label_kk: "Құжат күні",
    type: "date",
  },
  date: {
    label_ru: "Дата",
    label_kk: "Күні",
    type: "date",
  },
  department: {
    label_ru: "Название отдела",
    label_kk: "Бөлім атауы",
    type: "text",
  },
  registration_number: {
    label_ru: "Регистрационный номер",
    label_kk: "Тіркеу нөмірі",
    type: "text",
  },
  reg_number: {
    label_ru: "Регистрационный номер",
    label_kk: "Тіркеу нөмірі",
    type: "text",
  },
  document_title: {
    label_ru: "Название документа",
    label_kk: "Құжат атауы",
    type: "text",
    required: true,
  },
  title_ru: {
    label_ru: "Название (рус.)",
    label_kk: "Атау (орысша)",
    type: "text",
    required: true,
  },
  title_kk: {
    label_ru: "Название (каз.)",
    label_kk: "Атау (қазақша)",
    type: "text",
  },
  title: {
    label_ru: "Название документа",
    label_kk: "Құжат атауы",
    type: "text",
    required: true,
  },
  responsible_person: {
    label_ru: "Ответственный",
    label_kk: "Жауапты",
    type: "user",
  },
  signature_name: {
    label_ru: "Подпись",
    label_kk: "Қолтаңба",
    type: "text",
  },
  content_body: {
    label_ru: "Основное содержание",
    label_kk: "Негізгі мазмұн",
    type: "textarea",
  },
  body: {
    label_ru: "Содержание",
    label_kk: "Мазмұны",
    type: "textarea",
  },
  content: {
    label_ru: "Содержание",
    label_kk: "Мазмұны",
    type: "textarea",
  },
  summary: {
    label_ru: "Краткое описание",
    label_kk: "Қысқаша сипаттама",
    type: "textarea",
  },
  position: {
    label_ru: "Должность",
    label_kk: "Лауазымы",
    type: "text",
  },
  iin: {
    label_ru: "ИИН",
    label_kk: "ЖСН",
    type: "text",
  },
  phone: {
    label_ru: "Телефон",
    label_kk: "Телефон",
    type: "text",
  },
  email: {
    label_ru: "Email",
    label_kk: "Email",
    type: "text",
  },
  amount: {
    label_ru: "Сумма",
    label_kk: "Сома",
    type: "number",
  },
  sum: {
    label_ru: "Сумма",
    label_kk: "Сома",
    type: "number",
  },
};

const KEY_ALIASES: Record<string, string> = {
  фио: "full_name",
  дата: "document_date",
  номер: "registration_number",
  название: "document_title",
  заголовок: "document_title",
  содержание: "content_body",
  отдел: "department",
  должность: "position",
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

function humanizeKey(key: string): { ru: string; kk: string } {
  const cleaned = key.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return { ru: key, kk: key };
  const titled = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return { ru: titled, kk: titled };
}

function inferFieldType(key: string): TemplateFieldDef["type"] {
  const k = normalizeKey(key);
  if (k.includes("date") || k.includes("дата") || k.endsWith("_at")) return "date";
  if (
    k.includes("amount") ||
    k.includes("sum") ||
    k.includes("count") ||
    k.includes("number") && !k.includes("reg")
  ) {
    return "number";
  }
  if (
    k.includes("body") ||
    k.includes("content") ||
    k.includes("summary") ||
    k.includes("description") ||
    k.includes("comment") ||
    k.includes("содержание") ||
    k.includes("описание")
  ) {
    return "textarea";
  }
  if (k.includes("user") || k.includes("person") || k.includes("employee") || k.includes("signer")) {
    return "user";
  }
  return "text";
}

export function inferFieldDef(key: string): TemplateFieldDef {
  const normalized = normalizeKey(key);
  const alias = KEY_ALIASES[normalized] ?? normalized;
  const preset = PRESET_FIELDS[alias] ?? PRESET_FIELDS[normalized];

  if (preset) {
    return { key, ...preset, required: preset.required ?? false };
  }

  const labels = humanizeKey(key);
  return {
    key,
    label_ru: labels.ru,
    label_kk: labels.kk,
    type: inferFieldType(key),
    required: false,
  };
}

export function isRawFieldLabel(field: TemplateFieldDef): boolean {
  return (
    field.label_ru === field.key ||
    field.label_kk === field.key ||
    field.label_ru.trim() === "" ||
    field.label_kk.trim() === ""
  );
}

/** Merge scanned keys; fill labels/types from presets and heuristics. */
export function mergeTemplateFieldKeys(
  existing: TemplateFieldDef[],
  keys: string[],
): TemplateFieldDef[] {
  const byKey = new Map(existing.map((f) => [f.key, f]));

  for (const key of keys) {
    const inferred = inferFieldDef(key);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, inferred);
      continue;
    }
    if (isRawFieldLabel(prev)) {
      byKey.set(key, {
        ...prev,
        label_ru: inferred.label_ru,
        label_kk: inferred.label_kk,
        type: prev.type === "text" ? inferred.type : prev.type,
      });
    }
  }

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

const DEFAULT_TEMPLATE_NAMES = new Set([
  "",
  "новый шаблон",
  "жаңа үлгі",
  "new template",
  "template",
  "шаблон",
  "үлгі",
]);

export function isDefaultTemplateName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  return DEFAULT_TEMPLATE_NAMES.has(name.trim().toLowerCase());
}

export function humanizeFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (!base) return "";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

const CATEGORY_RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /приказ|распоряжен/i, category: "order" },
  { pattern: /договор|контракт/i, category: "contract" },
  { pattern: /заявлен/i, category: "application" },
  { pattern: /акт\b/i, category: "act" },
  { pattern: /протокол/i, category: "protocol" },
  { pattern: /служебн|записк/i, category: "memo" },
  { pattern: /должност|инструкц/i, category: "instruction" },
  { pattern: /отчет|есеп/i, category: "report" },
];

export function inferCategoryFromTitle(title: string): string | null {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(title)) return rule.category;
  }
  return null;
}
