import type { TemplateFieldDef } from "@/lib/templates/file-formats";

/** Generic internal memo (служебная записка) — field schema for template editor / seed scripts. */
export const MEMO_BODY_TEMPLATE = `Директору {{organization_name}}
{{recipient_position}}
{{recipient_name}}

От {{sender_position}}
{{sender_name}}

                         СЛУЖЕБНАЯ ЗАПИСКА

№ {{document_number}}
от {{document_date}}

Тема: {{document_subject}}

{{document_body}}

В связи с вышеизложенным прошу:

{{request_block}}

Приложение:
{{attachments}}

{{sender_position}}                    _____________ /{{sender_short_name}}/

Исполнитель:
{{executor_position}}
{{executor_name}}
тел. {{executor_phone}}`;

export const MEMO_TITLE_TEMPLATE_RU = "Служебная записка: {{document_subject}}";
export const MEMO_TITLE_TEMPLATE_KK = "Қызметтік жазба: {{document_subject}}";

export const MEMO_TEMPLATE_FIELDS: TemplateFieldDef[] = [
  {
    key: "organization_name",
    label_ru: "Организация",
    label_kk: "Ұйым",
    type: "text",
    required: true,
    source: "organization",
  },
  {
    key: "recipient_position",
    label_ru: "Должность адресата",
    label_kk: "Алушы лауазымы",
    type: "text",
    required: true,
  },
  {
    key: "recipient_name",
    label_ru: "ФИО адресата",
    label_kk: "Алушы аты-жөні",
    type: "text",
    required: true,
  },
  {
    key: "sender_position",
    label_ru: "Должность отправителя",
    label_kk: "Жіберуші лауазымы",
    type: "text",
    required: true,
    source: "signatory",
  },
  {
    key: "sender_name",
    label_ru: "ФИО отправителя",
    label_kk: "Жіберуші аты-жөні",
    type: "text",
    required: true,
    source: "signatory",
  },
  {
    key: "sender_short_name",
    label_ru: "ФИО отправителя (кратко)",
    label_kk: "Жіберуші (қысқа)",
    type: "text",
    required: true,
    source: "signatory",
  },
  {
    key: "document_number",
    label_ru: "Номер документа",
    label_kk: "Құжат нөмірі",
    type: "text",
    required: true,
    source: "system",
  },
  {
    key: "document_date",
    label_ru: "Дата документа",
    label_kk: "Құжат күні",
    type: "date",
    required: true,
    source: "system",
  },
  {
    key: "document_subject",
    label_ru: "Тема",
    label_kk: "Тақырып",
    type: "text",
    required: true,
  },
  {
    key: "document_body",
    label_ru: "Текст",
    label_kk: "Мәтін",
    type: "textarea",
    required: true,
  },
  {
    key: "request_block",
    label_ru: "Просьба / резолюция",
    label_kk: "Сұраныс",
    type: "textarea",
    required: true,
  },
  {
    key: "attachments",
    label_ru: "Приложения",
    label_kk: "Қосымшалар",
    type: "textarea",
    required: false,
  },
  {
    key: "executor_position",
    label_ru: "Должность исполнителя",
    label_kk: "Орындаушы лауазымы",
    type: "text",
    required: false,
    source: "author",
  },
  {
    key: "executor_name",
    label_ru: "Исполнитель",
    label_kk: "Орындаушы",
    type: "text",
    required: false,
    source: "author",
  },
  {
    key: "executor_phone",
    label_ru: "Телефон исполнителя",
    label_kk: "Орындаушы телефоны",
    type: "text",
    required: false,
    source: "author",
  },
];

export const MEMO_TEMPLATE_SCHEMA = {
  fields: MEMO_TEMPLATE_FIELDS,
  body_template: MEMO_BODY_TEMPLATE,
  title_template_ru: MEMO_TITLE_TEMPLATE_RU,
  title_template_kk: MEMO_TITLE_TEMPLATE_KK,
};
