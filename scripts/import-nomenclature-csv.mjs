import fs from "fs";
import path from "path";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: node scripts/import-nomenclature-csv.mjs <csv-path>");
  process.exit(1);
}

const lines = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
const esc = (s) => (s ?? "").replace(/'/g, "''");

const rows = lines.slice(1).map((line) => {
  const p = line.split(";");
  return {
    id: p[0],
    parent_id: p[1] || null,
    code: p[2],
    title_ru: p[3],
    title_kk: p[4],
    retention_years: p[5] || "0",
    archive_rule: p[6] || "standard",
    department_id: p[7] || null,
    sort_order: p[8] || "0",
    created_at: p[9],
    updated_at: p[10],
  };
});

const deptExpr = (id) =>
  id
    ? `(CASE WHEN EXISTS (SELECT 1 FROM public.departments d WHERE d.id = '${id}'::uuid) THEN '${id}'::uuid ELSE NULL END)`
    : "NULL";

const values = rows
  .map(
    (r) =>
      `  ('${r.id}'::uuid, ${r.parent_id ? `'${r.parent_id}'::uuid` : "NULL"}, '${esc(r.code)}', '${esc(r.title_ru)}', '${esc(r.title_kk)}', ${r.retention_years}::int, '${esc(r.archive_rule)}', ${deptExpr(r.department_id)}, ${r.sort_order}::int, '${r.created_at}'::timestamptz, '${r.updated_at}'::timestamptz)`,
  )
  .join(",\n");

const sql = `-- Seed nomenclature from CSV export (${rows.length} items)
INSERT INTO public.nomenclature_items (
  id, parent_id, code, title_ru, title_kk, retention_years, archive_rule, department_id, sort_order, created_at, updated_at
) VALUES
${values}
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  code = EXCLUDED.code,
  title_ru = EXCLUDED.title_ru,
  title_kk = EXCLUDED.title_kk,
  retention_years = EXCLUDED.retention_years,
  archive_rule = EXCLUDED.archive_rule,
  department_id = EXCLUDED.department_id,
  sort_order = EXCLUDED.sort_order,
  updated_at = EXCLUDED.updated_at;
`;

const out = path.join("supabase", "migrations", "20260610200000_seed_nomenclature_items.sql");
fs.writeFileSync(out, sql);
console.log(`Wrote ${rows.length} rows to ${out}`);
