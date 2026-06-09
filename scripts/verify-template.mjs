import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import { createClient } from "@supabase/supabase-js";

const id = process.argv[2];
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

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: tpl } = await sb.from("document_templates").select("*").eq("id", id).single();
console.log("DB:", { name: tpl?.name_ru, status: tpl?.status, fields: tpl?.schema?.fields?.length });

const { data, error } = await sb.storage.from("templates").download(tpl.file_path);
if (error) throw error;
const xml = new PizZip(Buffer.from(await data.arrayBuffer())).file("word/document.xml").asText();
const keys = [...xml.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1]);
console.log("Placeholders:", [...new Set(keys)].sort());
