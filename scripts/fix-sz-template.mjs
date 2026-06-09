import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import { createClient } from "@supabase/supabase-js";

const TEMPLATE_ID = "8eb10204-227a-4f50-a173-c3a1aa205ca3";
const SOURCE = process.argv[2] || "C:/Users/d.rykov/Desktop/СЗ.docx";
const STORAGE_PATH = `${TEMPLATE_ID}/SZ_sluzhebnaya_zapiska.docx`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, "..", ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);

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

  // Replace recall sentence tail (employee + date) before collapsing body
  once(
    "прошу Вас отозвать из ежегодного трудового отпуска  </w:t></w:r>",
    "прошу Вас отозвать из ежегодного трудового отпуска {{employee_name}} с {{recall_date}}.</w:t></w:r>",
  );

  doc = doc.replace(/<w:t>Сапрыкин<\/w:t>/g, "<w:t>{{employee_name}}</w:t>");
  doc = doc.replace(/<w:t>Сапрыкина В\. К\.<\/w:t>/g, "<w:t>{{employee_name}}</w:t>");
  doc = doc.replace(/<w:t>11<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<w:t>\.06\.2026\.<\/w:t>/, "<w:t>{{recall_date}}</w:t>");

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

const original = fs.readFileSync(SOURCE);
const zip = new PizZip(original);
zip.file("word/document.xml", injectPlaceholders(zip.file("word/document.xml").asText()));
const buffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { error } = await sb.storage.from("templates").upload(STORAGE_PATH, buffer, {
  contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  upsert: true,
});
if (error) throw error;

const xml = zip.file("word/document.xml").asText();
const keys = [...xml.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1]);
console.log("Fixed. Placeholders:", [...new Set(keys)].sort());
