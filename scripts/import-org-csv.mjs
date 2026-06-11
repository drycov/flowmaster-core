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

function sortByParent(rows, idKey = "id", parentKey = "parent_id") {
  const byId = new Map(rows.map((r) => [r[idKey], r]));
  const sorted = [];
  const done = new Set();

  const visit = (id) => {
    if (!id || done.has(id)) return;
    const row = byId.get(id);
    if (!row) return;
    if (row[parentKey] && !done.has(row[parentKey])) visit(row[parentKey]);
    if (!done.has(id)) {
      sorted.push(row);
      done.add(id);
    }
  };

  rows.forEach((r) => visit(r[idKey]));
  return sorted;
}

function userFkExpr(col, id) {
  if (!id) return "NULL";
  return `(CASE WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = '${id}'::uuid) THEN '${id}'::uuid ELSE NULL END)`;
}

function deptFkExpr(id) {
  if (!id) return "NULL";
  return `'${id}'::uuid`;
}

const deptCsv = process.argv[2];
const posCsv = process.argv[3];
if (!deptCsv || !posCsv) {
  console.error("Usage: node scripts/import-org-csv.mjs <departments.csv> <positions.csv>");
  process.exit(1);
}

const departments = sortByParent(parseSemicolonCsv(fs.readFileSync(deptCsv, "utf8")));
const positions = parseSemicolonCsv(fs.readFileSync(posCsv, "utf8"));

const deptValues = departments
  .map((r) => {
    const deputy =
      r.deputy_user_ids && r.deputy_user_ids !== "[]"
        ? `'${esc(r.deputy_user_ids)}'::uuid[]`
        : `'{}'::uuid[]`;
    return `  ('${r.id}'::uuid, ${r.parent_id ? `'${r.parent_id}'::uuid` : "NULL"}, '${esc(r.code)}', '${esc(r.name_ru)}', '${esc(r.name_kk)}', ${userFkExpr("head_user_id", r.head_user_id)}, '${esc(r.kind || "department")}', '${esc((r.phone || "").replace(/^\t+/, ""))}', '${esc(r.email || "")}', ${r.is_active === "false" ? "false" : "true"}, ${deputy}, '${r.created_at}'::timestamptz, '${r.updated_at}'::timestamptz)`;
  })
  .join(",\n");

const posValues = positions
  .map(
    (r) =>
      `  ('${r.id}'::uuid, '${esc(r.code)}', '${esc(r.title_ru)}', '${esc(r.title_kk)}', ${deptFkExpr(r.department_id)}, ${r.level || 0}::int, ${r.is_head === "true" ? "true" : "false"}, '${r.created_at}'::timestamptz, '${r.updated_at}'::timestamptz)`,
  )
  .join(",\n");

const nomenclatureDeptIds = [
  "78005b21-f7cb-4d0c-9ea1-3da26e0a7e66",
  "26b0c55d-8607-4f31-af78-776950fe5b8c",
  "bd22ccb4-f044-412c-9c52-377641fc642e",
  "2d1b9434-2e90-485c-b918-037b8c24fefa",
  "e5c531e6-b3ae-47bf-a757-298430a1296d",
  "8f169fb3-7fe7-49c0-bf08-3d6c179a44da",
  "0a99623d-b7d6-428d-a9c5-d538960c70b0",
];

const sql = `-- Seed departments and positions from CSV exports
-- Departments: ${departments.length}, Positions: ${positions.length}

INSERT INTO public.departments (
  id, parent_id, code, name_ru, name_kk, head_user_id, kind, phone, email, is_active, deputy_user_ids, created_at, updated_at
) VALUES
${deptValues}
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  code = EXCLUDED.code,
  name_ru = EXCLUDED.name_ru,
  name_kk = EXCLUDED.name_kk,
  head_user_id = EXCLUDED.head_user_id,
  kind = EXCLUDED.kind,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  is_active = EXCLUDED.is_active,
  deputy_user_ids = EXCLUDED.deputy_user_ids,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.positions (
  id, code, title_ru, title_kk, department_id, level, is_head, created_at, updated_at
) VALUES
${posValues}
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  title_ru = EXCLUDED.title_ru,
  title_kk = EXCLUDED.title_kk,
  department_id = EXCLUDED.department_id,
  level = EXCLUDED.level,
  is_head = EXCLUDED.is_head,
  updated_at = EXCLUDED.updated_at;

-- Re-link nomenclature items to departments (from prior export)
UPDATE public.nomenclature_items n SET department_id = v.dept_id
FROM (VALUES
  ('dd2fd3ec-04a9-45a8-ac55-13215f26401d'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('76618250-51a5-4e0c-95fc-da220f51df3a'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('7ab62545-1d94-46a3-9bbd-5fec648a71aa'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('55e360e8-e13e-43af-8cec-7179914808fe'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('97cf4eb8-31b0-4cd7-bbf1-5f322245bf2f'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('69696112-c875-479a-9b99-2837877a86ff'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('a5691545-6287-476c-8579-3f7bfa80df17'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('c71331b2-23a2-4f16-a433-0e35e4a56a2b'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('6352e65a-be26-4181-b881-1ba8920b3320'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('f21a3b24-7c3d-4e47-9a9b-ab36f0ec0c1c'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('a0c35486-3288-4ec3-845d-374affeac753'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('738313fe-6a92-426f-b9e8-4ff468505575'::uuid, '26b0c55d-8607-4f31-af78-776950fe5b8c'::uuid),
  ('3255a291-1620-4725-be16-8a540edacfdc'::uuid, '26b0c55d-8607-4f31-af78-776950fe5b8c'::uuid),
  ('253a8247-d2f0-42ae-8004-c42202164d41'::uuid, '26b0c55d-8607-4f31-af78-776950fe5b8c'::uuid),
  ('c93259c0-dfa4-4d54-a61b-90abab4181b9'::uuid, '26b0c55d-8607-4f31-af78-776950fe5b8c'::uuid),
  ('f9d546ec-9616-4ea0-a7c2-13028e8b7620'::uuid, '26b0c55d-8607-4f31-af78-776950fe5b8c'::uuid),
  ('b415eeec-ac28-4895-b155-6988d9621950'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('86f98c36-94c6-4097-ba77-cd750fbaadbf'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('9c7932ee-8a34-4dd5-95f6-4773765f7355'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('afd55e59-1988-43d3-b59f-4882ddef97e2'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('fac10e7f-52ce-49cc-9b39-1f9821571112'::uuid, 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid),
  ('8014ae8b-266e-40a0-8e70-04ee42dc36af'::uuid, 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid),
  ('9efcdf76-555e-473a-b03f-915c837868bd'::uuid, 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid),
  ('d3014515-54df-4327-905e-3106c5e7ade4'::uuid, '2d1b9434-2e90-485c-b918-037b8c24fefa'::uuid),
  ('ebe1ead5-ebcf-42bd-8621-759c0eeaf9d7'::uuid, 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid),
  ('787bfd04-8e1a-487c-b6f7-510db7d32878'::uuid, '2d1b9434-2e90-485c-b918-037b8c24fefa'::uuid),
  ('9670f31d-7042-4988-9edd-b295ae21b7fc'::uuid, 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid),
  ('ea9ad579-5d28-44ea-9709-ffe1d665778d'::uuid, 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid),
  ('ea04c169-3eb8-4220-a382-0ed7fee9edf0'::uuid, 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid),
  ('6c526772-db83-4bcf-be37-e70e32a9339f'::uuid, 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid),
  ('d84ac0a4-6744-4c5b-9e37-532a5364636d'::uuid, 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid),
  ('756ce796-eb15-4469-b8ed-f62fc6614f07'::uuid, '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid),
  ('c1cf204a-1880-44ad-8345-63a64ba8c472'::uuid, '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid),
  ('7d1c98bc-d8e8-4026-8f60-7d8a5b6ff923'::uuid, '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid),
  ('b3347139-c4f8-4aaa-bb57-040ec128db94'::uuid, '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid),
  ('3015da13-b31b-4e1b-ba7d-c5d5c928fe71'::uuid, '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid),
  ('43338d1a-fe4e-435d-ae45-d6973e7836f6'::uuid, '0a99623d-b7d6-428d-a9c5-d538960c70b0'::uuid),
  ('25c6a6a5-bb17-43e7-afef-784de902d78d'::uuid, '0a99623d-b7d6-428d-a9c5-d538960c70b0'::uuid),
  ('1329e820-19ec-46ed-b25e-137968cff6f3'::uuid, '2d1b9434-2e90-485c-b918-037b8c24fefa'::uuid),
  ('08d9f144-cd92-4c30-8bc2-b89dd71ab3b3'::uuid, '0a99623d-b7d6-428d-a9c5-d538960c70b0'::uuid),
  ('8e2ec434-005e-4a71-bdea-e055016e19ef'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('7f5caa2d-8205-4b3b-9685-e0b840c71c97'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('05025cbc-2993-44c2-9c5b-6dcd7ad83d75'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('c442e533-f4aa-462e-ab8c-c7e45f0f20ee'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('45141b77-b53b-480a-a38c-70aad686e0bb'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('bf98af11-8f2b-4865-bda6-493d1d1f6ba7'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('0bc9bf24-e213-4070-88c1-50e6309ac168'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid)
) AS v(nom_id, dept_id)
WHERE n.id = v.nom_id;
`;

const out = path.join("supabase", "seeds", "seed_departments_positions.sql");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, sql);
console.log(`Wrote seed SQL: ${departments.length} departments, ${positions.length} positions -> ${out}`);
console.log("Apply manually via psql (see supabase/seeds/README.md)");
