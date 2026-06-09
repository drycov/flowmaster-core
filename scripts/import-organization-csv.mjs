import fs from "fs";
import path from "path";

function parseLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ";" && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function parseSemicolonCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = parseLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseLine(line);
    const row = {};
    header.forEach((h, i) => {
      row[h] = (values[i] ?? "").trim();
    });
    return row;
  });
}

const esc = (s) => (s ?? "").replace(/'/g, "''");

function userFkExpr(id) {
  if (!id) return "NULL";
  return `(CASE WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = '${id}'::uuid) THEN '${id}'::uuid ELSE NULL END)`;
}

const orgCsv = process.argv[2];
if (!orgCsv) {
  console.error("Usage: node scripts/import-organization-csv.mjs <organization.csv>");
  process.exit(1);
}

const [org] = parseSemicolonCsv(fs.readFileSync(orgCsv, "utf8"));
if (!org) {
  console.error("No organization row found in CSV");
  process.exit(1);
}

const sql = `-- Seed organization singleton from CSV export
-- Replace default placeholder with SATORY requisites

DELETE FROM public.organization
WHERE id <> '${org.id}'::uuid;

INSERT INTO public.organization (
  id, name_ru, name_kk, short_name_ru, short_name_kk, bin,
  legal_address_ru, legal_address_kk, phone, email, website,
  head_user_id, logo_url, reg_number_prefix, created_at, updated_at
) VALUES (
  '${org.id}'::uuid,
  '${esc(org.name_ru)}',
  '${esc(org.name_kk)}',
  '${esc(org.short_name_ru)}',
  '${esc(org.short_name_kk)}',
  '${esc(org.bin)}',
  '${esc(org.legal_address_ru)}',
  '${esc(org.legal_address_kk)}',
  '${esc(org.phone)}',
  '${esc(org.email)}',
  '${esc(org.website)}',
  ${userFkExpr(org.head_user_id)},
  '${esc(org.logo_url)}',
  '${esc(org.reg_number_prefix || "DOC")}',
  '${org.created_at}'::timestamptz,
  '${org.updated_at}'::timestamptz
)
ON CONFLICT (id) DO UPDATE SET
  name_ru = EXCLUDED.name_ru,
  name_kk = EXCLUDED.name_kk,
  short_name_ru = EXCLUDED.short_name_ru,
  short_name_kk = EXCLUDED.short_name_kk,
  bin = EXCLUDED.bin,
  legal_address_ru = EXCLUDED.legal_address_ru,
  legal_address_kk = EXCLUDED.legal_address_kk,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  website = EXCLUDED.website,
  head_user_id = EXCLUDED.head_user_id,
  logo_url = EXCLUDED.logo_url,
  reg_number_prefix = EXCLUDED.reg_number_prefix,
  updated_at = EXCLUDED.updated_at;
`;

const out = path.join("supabase", "migrations", "20260610220000_seed_organization.sql");
fs.writeFileSync(out, sql);
console.log(`Wrote migration: organization "${org.name_ru}" -> ${out}`);
