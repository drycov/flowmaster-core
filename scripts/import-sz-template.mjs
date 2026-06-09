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

  once("Директору филиала", "{{recipient_position}}");
  once("Бирюкову В. Ю.", "{{recipient_name}}");
  once("От Начальника ОЭСС", "От {{sender_position}}");
  once("Рыкова Д. И.", "{{sender_name}}");

  once(
    "прошу Вас отозвать из ежегодного трудового отпуска  </w:t></w:r>",
    "прошу Вас отозвать из ежегодного трудового отпуска {{employee_name}} с {{recall_date}}.</w:t></w:r>",
  );

  doc = doc.replace(/<w:t>Сапрыкин<\/w:t>/g, "<w:t>{{employee_name}}</w:t>");
  doc = doc.replace(/<w:t>Сапрыкина В\. К\.<\/w:t>/g, "<w:t>{{employee_name}}</w:t>");

  const bodyStart = doc.indexOf("В связи с производственной необходимостью");
  const bodyEnd = doc.indexOf("<w:t>{{employee_name}}</w:t>");
  if (bodyStart !== -1 && bodyEnd !== -1 && bodyEnd > bodyStart) {
    const afterRecall = doc.indexOf("</w:p>", bodyEnd);
    const nextPara = doc.indexOf("<w:p ", afterRecall + 1);
    const signPara = doc.indexOf("<w:t>Начальник ОЭСС", nextPara);
    const paraEnd = doc.lastIndexOf("</w:p>", signPara > 0 ? signPara : doc.length);
    const paraStart = doc.lastIndexOf("<w:p ", paraEnd);
    if (paraStart !== -1 && paraEnd !== -1 && paraEnd > paraStart) {
      const placeholderPara =
        '<w:p w14:paraId="MEMO0001" w14:textId="MEMO0001" w:rsidR="00000000">' +
        '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>' +
        "<w:t>{{memo_body}}</w:t></w:r></w:p>";
      doc = doc.slice(0, paraStart) + placeholderPara + doc.slice(paraEnd + "</w:p>".length);
    }
  }

  once("Начальник ОЭСС Рыков Д.И.", "{{signatory_line}}");
  once(">10</w:t>", ">{{document_date}}</w:t>");
  once("Рыков Д.И.", "{{executor_name}}");

  return doc;
}

const FIELDS = [
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
  },
  {
    key: "sender_name",
    label_ru: "ФИО отправителя",
    label_kk: "Жіберуші аты-жөні",
    type: "text",
    required: true,
  },
  {
    key: "employee_name",
    label_ru: "ФИО сотрудника (в отпуске)",
    label_kk: "Демалыстағы қызметкер",
    type: "text",
    required: true,
  },
  {
    key: "recall_date",
    label_ru: "Дата отзыва из отпуска",
    label_kk: "Демалыстан шақыру күні",
    type: "date",
    required: true,
  },
  {
    key: "memo_body",
    label_ru: "Обоснование",
    label_kk: "Негіздеме",
    type: "textarea",
    required: true,
  },
  {
    key: "signatory_line",
    label_ru: "Подпись (должность и ФИО)",
    label_kk: "Қолтаңба (лауазым және аты-жөні)",
    type: "text",
    required: true,
  },
  {
    key: "document_date",
    label_ru: "Дата документа",
    label_kk: "Құжат күні",
    type: "date",
    required: true,
  },
  {
    key: "executor_name",
    label_ru: "Исполнитель",
    label_kk: "Орындаушы",
    type: "text",
    required: false,
  },
];

async function main() {
  const sourcePath =
    process.argv[2] || "C:/Users/d.rykov/Desktop/СЗ.docx";

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
    "Шаблон служебной записки (отзыв сотрудника из отпуска). Создан из файла СЗ.docx.";

  const defaultBody =
    "В связи с производственной необходимостью прошу Вас отозвать из ежегодного трудового отпуска {{employee_name}} с {{recall_date}}.\n\n{{memo_body}}";

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
        body_template: defaultBody,
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

  console.log(JSON.stringify({
    ok: true,
    template_id: template.id,
    name_ru: nameRu,
    storage_path: storagePath,
    fields: FIELDS.map((f) => f.key),
    editor_url: `http://localhost:4000/templates/${template.id}`,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
