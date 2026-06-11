import type { TemplateFieldDef } from "@/lib/templates/file-formats";

type FieldOpts = {
  required?: boolean;
  source?: TemplateFieldDef["source"];
  type?: TemplateFieldDef["type"];
};

export function fld(
  key: string,
  label_ru: string,
  label_kk: string,
  opts: FieldOpts = {},
): TemplateFieldDef {
  return {
    key,
    label_ru,
    label_kk,
    type: opts.type ?? "text",
    required: opts.required ?? false,
    ...(opts.source ? { source: opts.source } : {}),
  };
}

export const ORG_FIELD = fld("organization_name", "Организация", "Ұйым", {
  required: true,
  source: "organization",
});

export const DOC_DATE_FIELD = fld("document_date", "Дата документа", "Құжат күні", {
  required: true,
  type: "date",
  source: "system",
});

export const DOC_NUMBER_FIELD = fld("document_number", "Номер документа", "Құжат нөмірі", {
  required: true,
  source: "system",
});

export const SUBJECT_FIELD = fld("document_subject", "Тема", "Тақырып", { required: true });

export const BODY_FIELD = fld("document_body", "Текст", "Мәтін", {
  required: true,
  type: "textarea",
});

export const SIGNER_NAME = fld("signer_name", "ФИО подписанта", "Қол қоюшы аты-жөні", {
  required: true,
  source: "signatory",
});

export const SIGNER_POSITION = fld("signer_position", "Должность подписанта", "Қол қоюшы лауазымы", {
  required: true,
  source: "signatory",
});

export const EXECUTOR_NAME = fld("executor_name", "Исполнитель", "Орындаушы", {
  source: "author",
});

export const EXECUTOR_POSITION = fld("executor_position", "Должность исполнителя", "Орындаушы лауазымы", {
  source: "author",
});

export const EXECUTOR_PHONE = fld("executor_phone", "Телефон исполнителя", "Орындаушы телефоны", {
  source: "author",
});

export const ATTACHMENTS_FIELD = fld("attachments", "Приложения", "Қосымшалар", {
  type: "textarea",
});
