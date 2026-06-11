/**
 * Import СЗ.docx as a published template (службная записка).
 * Usage: node scripts/import-sz-template.mjs [path-to-docx]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const MEMO_BODY_TEMPLATE = `Директору {{organization_name}}
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

const FIELDS = [
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

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) throw new Error(".env not found");
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function templateFilePath(templateId, filename) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${templateId}/${safe}`;
}

function injectPlaceholders(xml) {
  let doc = xml;

  const once = (from, to) => {
    const i = doc.indexOf(from);
    if (i === -1) return false;
    doc = doc.slice(0, i) + to + doc.slice(i + from.length);
    return true;
  };

  once("Директору филиала", "Директору {{organization_name}}");
  once("Бирюкову В. Ю.", "{{recipient_name}}");
  once("От Начальника ОЭСС", "От {{sender_position}}");
  once("Рыкова Д. И.", "{{sender_name}}");

  once(">10</w:t>", ">{{document_date}}</w:t>");

  once("Начальник ОЭСС Рыков Д.И.", "{{sender_position}} _____________ /{{sender_short_name}}/");
  once("Рыков Д.И.", "{{executor_name}}");

  return doc;
}

async function main() {
  const sourcePath = process.argv[2] || "C:/Users/d.rykov/Desktop/СЗ.docx";

  if (!fs.existsSync(sourcePath)) {
    console.error("File not found:", sourcePath);
    process.exit(1);
  }

  const env = loadEnv();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .maybeSingle();

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  const createdBy = roleRow?.user_id ?? adminProfile?.id;
  if (!createdBy) {
    console.error("No user found for created_by");
    process.exit(1);
  }

  const original = fs.readFileSync(sourcePath);
  const zip = new PizZip(original);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Invalid DOCX: no document.xml");

  const patchedXml = injectPlaceholders(docFile.asText());
  zip.file("word/document.xml", patchedXml);
  const patchedBuffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });

  const nameRu = "Служебная записка";
  const nameKk = "Қызметтік жазба";
  const description =
    "Универсальный шаблон служебной записки. Системные поля (организация, отправитель, исполнитель, номер, дата) заполняются автоматически.";

  const { data: template, error: insertErr } = await supabase
    .from("document_templates")
    .insert({
      name_ru: nameRu,
      name_kk: nameKk,
      category: "memo",
      description,
      status: "published",
      file_format: "docx",
      schema: {
        fields: FIELDS,
        body_template: MEMO_BODY_TEMPLATE,
        title_template_ru: "Служебная записка: {{document_subject}}",
        title_template_kk: "Қызметтік жазба: {{document_subject}}",
      },
      allow_custom_route: true,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (insertErr || !template) {
    console.error("Insert failed:", insertErr?.message);
    process.exit(1);
  }

  const filename = "SZ_sluzhebnaya_zapiska.docx";
  const storagePath = templateFilePath(template.id, filename);

  const { error: uploadErr } = await supabase.storage
    .from("templates")
    .upload(storagePath, patchedBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

  if (uploadErr) {
    console.error("Upload failed:", uploadErr.message);
    await supabase.from("document_templates").delete().eq("id", template.id);
    process.exit(1);
  }

  const { error: linkErr } = await supabase
    .from("document_templates")
    .update({ file_path: storagePath, file_format: "docx" })
    .eq("id", template.id);

  if (linkErr) {
    console.error("Link failed:", linkErr.message);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        template_id: template.id,
        name_ru: nameRu,
        storage_path: storagePath,
        user_fields: FIELDS.filter((f) => !f.source).map((f) => f.key),
        auto_fields: FIELDS.filter((f) => f.source).map((f) => f.key),
        editor_url: `http://localhost:4000/templates/${template.id}`,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
