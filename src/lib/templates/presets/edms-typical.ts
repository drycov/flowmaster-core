import type { TemplateFieldDef } from "@/lib/templates/file-formats";
import {
  ATTACHMENTS_FIELD,
  BODY_FIELD,
  DOC_DATE_FIELD,
  DOC_NUMBER_FIELD,
  EXECUTOR_NAME,
  EXECUTOR_PHONE,
  EXECUTOR_POSITION,
  ORG_FIELD,
  SIGNER_NAME,
  SIGNER_POSITION,
  SUBJECT_FIELD,
  fld,
} from "./common-fields";
import {
  EDMS_TPL_ACT,
  EDMS_TPL_APPLICATION,
  EDMS_TPL_CONTRACT,
  EDMS_TPL_INCOMING,
  EDMS_TPL_INTERNAL,
  EDMS_TPL_MEMO,
  EDMS_TPL_ORDER,
  EDMS_TPL_OUTGOING,
  EDMS_TPL_PROTOCOL,
  EDMS_TPL_REPORT,
  EDMS_WF_ACT,
  EDMS_WF_APPLICATION,
  EDMS_WF_CONTRACT,
  EDMS_WF_INCOMING,
  EDMS_WF_INTERNAL,
  EDMS_WF_MEMO,
  EDMS_WF_ORDER,
  EDMS_WF_OUTGOING,
  EDMS_WF_PROTOCOL,
  EDMS_WF_REPORT,
} from "./edms-package.constants";
import { MEMO_TEMPLATE_SCHEMA } from "./memo";

export type EdmsTemplateSeed = {
  id: string;
  name_ru: string;
  name_kk: string;
  category: string;
  description: string;
  default_workflow_id: string;
  schema: {
    fields: TemplateFieldDef[];
    body_template: string;
    title_template_ru?: string;
    title_template_kk?: string;
  };
};

const INCOMING_BODY = `{{organization_name}}

ВХОДЯЩИЙ ДОКУМЕНТ

Вх. № {{external_reg_number}} от {{correspondent_name}}
Дата поступления: {{received_date}}

Тема: {{document_subject}}

Краткое содержание:
{{document_summary}}

Исполнитель: {{executor_name}}, {{executor_position}}
Резолюция / поручение:
{{resolution}}

Приложение: {{attachments}}`;

const OUTGOING_BODY = `{{organization_name}}

{{correspondent_name}}
{{correspondent_address}}

Исх. № {{document_number}}
от {{document_date}}

{{document_subject}}

Уважаемый(ая) {{correspondent_contact}}!

{{document_body}}

Приложение: {{attachments}}

С уважением,
{{signer_position}}
_______________ /{{signer_name}}/

Исп.: {{executor_name}}, тел. {{executor_phone}}`;

const INTERNAL_BODY = `{{organization_name}}

ВНУТРЕННИЙ ДОКУМЕНТ

№ {{document_number}}
от {{document_date}}

{{document_subject}}

{{document_body}}

{{signer_position}}                    _______________ /{{signer_name}}/`;

const ORDER_BODY = `{{organization_name}}

ПРИКАЗ № {{document_number}}

{{document_date}}
{{order_city}}

{{order_subject}}

{{order_preamble}}

ПРИКАЗЫВАЮ:
{{order_items}}

Контроль за исполнением оставить за {{control_person}}.

{{signer_position}}                    _______________ /{{signer_name}}/`;

const CONTRACT_BODY = `{{organization_name}}

ДОГОВОР № {{contract_number}}

г. {{contract_city}}                                    {{contract_date}}

{{organization_name}}, именуемое в дальнейшем «Заказчик», в лице {{signer_position}} {{signer_name}},
с одной стороны, и {{correspondent_name}}, именуемое в дальнейшем «Исполнитель», в лице {{correspondent_representative}},
с другой стороны, заключили настоящий договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
{{contract_subject}}

2. СТОИМОСТЬ И ПОРЯДОК РАСЧЁТОВ
Сумма договора: {{contract_amount}} тенге.
Срок действия: {{contract_term}}.

3. ПРАВА И ОБЯЗАННОСТИ СТОРОН
{{contract_body}}

4. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ
{{contract_closing}}

Заказчик: _______________ /{{signer_name}}/
Исполнитель: _______________ /{{correspondent_representative}}/`;

const PROTOCOL_BODY = `{{organization_name}}

ПРОТОКОЛ № {{protocol_number}}

{{protocol_date}}

Председатель: {{meeting_chair}}
Секретарь: {{meeting_secretary}}

Присутствовали:
{{participants}}

ПОВЕСТКА ДНЯ:
{{agenda}}

СЛУШАЛИ:
{{discussion}}

ПОСТАНОВИЛИ:
{{decisions}}

Председатель _______________ /{{meeting_chair}}/
Секретарь _______________ /{{meeting_secretary}}/`;

const ACT_BODY = `{{organization_name}}

АКТ № {{act_number}}

{{act_date}}

{{act_subject}}

Основание: {{act_basis}}

{{organization_name}} ({{party_a}}) и {{correspondent_name}} ({{party_b}}) составили настоящий акт о нижеследующем:

{{act_body}}

Стороны претензий друг к другу не имеют.

От Заказчика: _______________ /{{party_a}}/
От Исполнителя: _______________ /{{party_b}}/`;

const APPLICATION_BODY = `{{organization_name}}

ЗАЯВЛЕНИЕ

от {{full_name}}
{{position}}, {{department}}

{{document_date}}

{{application_subject}}

{{application_body}}


{{full_name}}                    _______________`;

const REPORT_BODY = `{{organization_name}}

ОТЧЁТ

за период: {{report_period}}

Тема: {{report_subject}}

Краткие выводы:
{{report_summary}}

{{report_body}}

{{author_position}}                    _______________ /{{author_name}}/`;

export const EDMS_TYPICAL_TEMPLATES: EdmsTemplateSeed[] = [
  {
    id: EDMS_TPL_INCOMING,
    name_ru: "Входящий документ",
    name_kk: "Кіріс құжаты",
    category: "incoming",
    description: "Регистрационная карточка входящей корреспонденции",
    default_workflow_id: EDMS_WF_INCOMING,
    schema: {
      title_template_ru: "Вх. № {{external_reg_number}} — {{document_subject}}",
      title_template_kk: "Кіріс № {{external_reg_number}} — {{document_subject}}",
      fields: [
        ORG_FIELD,
        fld("correspondent_name", "Контрагент", "Контрагент", { required: true }),
        fld("external_reg_number", "Вх. № контрагента", "Контрагент кіріс нөмірі", { required: true }),
        fld("received_date", "Дата поступления", "Түскен күні", { required: true, type: "date" }),
        SUBJECT_FIELD,
        fld("document_summary", "Краткое содержание", "Қысқаша мазмұны", {
          required: true,
          type: "textarea",
        }),
        EXECUTOR_NAME,
        EXECUTOR_POSITION,
        fld("resolution", "Резолюция / поручение", "Резолюция / тапсырма", { type: "textarea" }),
        ATTACHMENTS_FIELD,
      ],
      body_template: INCOMING_BODY,
    },
  },
  {
    id: EDMS_TPL_OUTGOING,
    name_ru: "Исходящее письмо",
    name_kk: "Шығыс хат",
    category: "outgoing",
    description: "Стандартное исходящее письмо контрагенту",
    default_workflow_id: EDMS_WF_OUTGOING,
    schema: {
      title_template_ru: "Исх. письмо: {{document_subject}}",
      title_template_kk: "Шығыс хат: {{document_subject}}",
      fields: [
        ORG_FIELD,
        fld("correspondent_name", "Контрагент", "Контрагент", { required: true }),
        fld("correspondent_address", "Адрес контрагента", "Контрагент мекенжайы", { type: "textarea" }),
        fld("correspondent_contact", "Кому (обращение)", "Кімге", { required: true }),
        DOC_NUMBER_FIELD,
        DOC_DATE_FIELD,
        SUBJECT_FIELD,
        BODY_FIELD,
        SIGNER_POSITION,
        SIGNER_NAME,
        EXECUTOR_NAME,
        EXECUTOR_PHONE,
        ATTACHMENTS_FIELD,
      ],
      body_template: OUTGOING_BODY,
    },
  },
  {
    id: EDMS_TPL_INTERNAL,
    name_ru: "Внутренний документ",
    name_kk: "Ішкі құжат",
    category: "internal",
    description: "Распоряжение или внутренняя служебная записка без адресата",
    default_workflow_id: EDMS_WF_INTERNAL,
    schema: {
      title_template_ru: "Внутренний: {{document_subject}}",
      title_template_kk: "Ішкі: {{document_subject}}",
      fields: [
        ORG_FIELD,
        DOC_NUMBER_FIELD,
        DOC_DATE_FIELD,
        SUBJECT_FIELD,
        BODY_FIELD,
        SIGNER_POSITION,
        SIGNER_NAME,
      ],
      body_template: INTERNAL_BODY,
    },
  },
  {
    id: EDMS_TPL_ORDER,
    name_ru: "Приказ",
    name_kk: "Бұйрық",
    category: "order",
    description: "Организационно-распорядительный приказ",
    default_workflow_id: EDMS_WF_ORDER,
    schema: {
      title_template_ru: "Приказ № {{document_number}} — {{order_subject}}",
      title_template_kk: "Бұйрық № {{document_number}} — {{order_subject}}",
      fields: [
        ORG_FIELD,
        DOC_NUMBER_FIELD,
        DOC_DATE_FIELD,
        fld("order_city", "Место издания", "Шығарылған жері"),
        fld("order_subject", "Заголовок приказа", "Бұйрық тақырыбы", { required: true }),
        fld("order_preamble", "Преамбула", "Кіріспе", { type: "textarea" }),
        fld("order_items", "Пункты приказа", "Бұйрық тармақтары", {
          required: true,
          type: "textarea",
        }),
        fld("control_person", "Контроль исполнения", "Бақылау", { required: true }),
        SIGNER_POSITION,
        SIGNER_NAME,
      ],
      body_template: ORDER_BODY,
    },
  },
  {
    id: EDMS_TPL_CONTRACT,
    name_ru: "Договор",
    name_kk: "Шарт",
    category: "contract",
    description: "Типовой договор с контрагентом",
    default_workflow_id: EDMS_WF_CONTRACT,
    schema: {
      title_template_ru: "Договор № {{contract_number}} — {{correspondent_name}}",
      title_template_kk: "Шарт № {{contract_number}} — {{correspondent_name}}",
      fields: [
        ORG_FIELD,
        fld("contract_number", "Номер договора", "Шарт нөмірі", { required: true }),
        fld("contract_date", "Дата договора", "Шарт күні", { required: true, type: "date" }),
        fld("contract_city", "Место заключения", "Жасалған жері"),
        fld("correspondent_name", "Контрагент", "Контрагент", { required: true }),
        fld("correspondent_representative", "Представитель контрагента", "Контрагент өкілі", {
          required: true,
        }),
        fld("contract_subject", "Предмет договора", "Шарт пәні", { required: true, type: "textarea" }),
        fld("contract_amount", "Сумма", "Сома", { required: true }),
        fld("contract_term", "Срок действия", "Мерзімі", { required: true }),
        fld("contract_body", "Условия", "Шарттар", { required: true, type: "textarea" }),
        fld("contract_closing", "Заключительные положения", "Қорытынды", { type: "textarea" }),
        SIGNER_POSITION,
        SIGNER_NAME,
      ],
      body_template: CONTRACT_BODY,
    },
  },
  {
    id: EDMS_TPL_MEMO,
    name_ru: "Служебная записка",
    name_kk: "Қызметтік жазба",
    category: "memo",
    description: "Типовая служебная записка с адресатом и блоком исполнителя",
    default_workflow_id: EDMS_WF_MEMO,
    schema: MEMO_TEMPLATE_SCHEMA,
  },
  {
    id: EDMS_TPL_PROTOCOL,
    name_ru: "Протокол совещания",
    name_kk: "Кеңес хаттамасы",
    category: "protocol",
    description: "Протокол заседания / совещания",
    default_workflow_id: EDMS_WF_PROTOCOL,
    schema: {
      title_template_ru: "Протокол № {{protocol_number}} — {{document_subject}}",
      title_template_kk: "Хаттама № {{protocol_number}} — {{document_subject}}",
      fields: [
        ORG_FIELD,
        fld("protocol_number", "Номер протокола", "Хаттама нөмірі", { required: true }),
        fld("protocol_date", "Дата", "Күні", { required: true, type: "date" }),
        SUBJECT_FIELD,
        fld("meeting_chair", "Председатель", "Төраға", { required: true }),
        fld("meeting_secretary", "Секретарь", "Хатшы", { required: true }),
        fld("participants", "Участники", "Қатысушылар", { required: true, type: "textarea" }),
        fld("agenda", "Повестка дня", "Күн тәртібі", { required: true, type: "textarea" }),
        fld("discussion", "Слушали", "Тыңдалды", { type: "textarea" }),
        fld("decisions", "Постановили", "Қаулы етілді", { required: true, type: "textarea" }),
      ],
      body_template: PROTOCOL_BODY,
    },
  },
  {
    id: EDMS_TPL_ACT,
    name_ru: "Акт",
    name_kk: "Акт",
    category: "act",
    description: "Акт выполненных работ / приёмки-передачи",
    default_workflow_id: EDMS_WF_ACT,
    schema: {
      title_template_ru: "Акт № {{act_number}} — {{act_subject}}",
      title_template_kk: "Акт № {{act_number}} — {{act_subject}}",
      fields: [
        ORG_FIELD,
        fld("act_number", "Номер акта", "Акт нөмірі", { required: true }),
        fld("act_date", "Дата", "Күні", { required: true, type: "date" }),
        fld("act_subject", "Предмет акта", "Акт пәні", { required: true }),
        fld("act_basis", "Основание", "Негіз", { required: true }),
        fld("correspondent_name", "Контрагент", "Контрагент", { required: true }),
        fld("party_a", "Представитель заказчика", "Тапсырыс беруші", { required: true }),
        fld("party_b", "Представитель исполнителя", "Орындаушы", { required: true }),
        fld("act_body", "Содержание акта", "Акт мазмұны", { required: true, type: "textarea" }),
      ],
      body_template: ACT_BODY,
    },
  },
  {
    id: EDMS_TPL_APPLICATION,
    name_ru: "Заявление",
    name_kk: "Өтініш",
    category: "application",
    description: "Общее заявление сотрудника (не отпуск — для отпуска есть отдельный шаблон)",
    default_workflow_id: EDMS_WF_APPLICATION,
    schema: {
      title_template_ru: "Заявление: {{application_subject}} — {{full_name}}",
      title_template_kk: "Өтініш: {{application_subject}} — {{full_name}}",
      fields: [
        ORG_FIELD,
        fld("full_name", "ФИО", "Аты-жөні", { required: true, source: "author" }),
        fld("position", "Должность", "Лауазым", { required: true, source: "author" }),
        fld("department", "Подразделение", "Бөлім", { required: true, source: "author" }),
        DOC_DATE_FIELD,
        fld("application_subject", "Тема заявления", "Өтініш тақырыбы", { required: true }),
        fld("application_body", "Текст заявления", "Өтініш мәтіні", { required: true, type: "textarea" }),
      ],
      body_template: APPLICATION_BODY,
    },
  },
  {
    id: EDMS_TPL_REPORT,
    name_ru: "Отчёт",
    name_kk: "Есеп",
    category: "report",
    description: "Служебный отчёт за период",
    default_workflow_id: EDMS_WF_REPORT,
    schema: {
      title_template_ru: "Отчёт: {{report_subject}} ({{report_period}})",
      title_template_kk: "Есеп: {{report_subject}} ({{report_period}})",
      fields: [
        ORG_FIELD,
        fld("report_period", "Отчётный период", "Есеп кезеңі", { required: true }),
        fld("report_subject", "Тема отчёта", "Есеп тақырыбы", { required: true }),
        fld("report_summary", "Краткие выводы", "Қысқаша қорытынды", {
          required: true,
          type: "textarea",
        }),
        fld("report_body", "Содержание отчёта", "Есеп мазмұны", { required: true, type: "textarea" }),
        fld("author_name", "Составитель", "Дайындаушы", { required: true, source: "author" }),
        fld("author_position", "Должность составителя", "Дайындаушы лауазымы", {
          required: true,
          source: "author",
        }),
      ],
      body_template: REPORT_BODY,
    },
  },
];
