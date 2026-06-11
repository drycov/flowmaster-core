/**
 * Generate SQL migration from src/lib/templates/presets/edms-typical.ts
 * Usage: node scripts/generate-edms-templates-migration.mjs
 */
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(
  root,
  "supabase/migrations/20260618110000_edms_document_templates_package.sql",
);

const json = execSync(
  `npx tsx -e "import { EDMS_TYPICAL_TEMPLATES } from './src/lib/templates/presets/edms-typical.ts'; process.stdout.write(JSON.stringify(EDMS_TYPICAL_TEMPLATES));"`,
  { cwd: root, encoding: "utf8" },
);

const templates = JSON.parse(json);

const lines = [
  "-- EDMS typical document templates (generated from src/lib/templates/presets/edms-typical.ts)",
  "-- Regenerate: node scripts/generate-edms-templates-migration.mjs",
  "",
  "-- Align HR leave package templates with document type categories for the creation form.",
  "UPDATE public.document_templates SET category = 'application'",
  "WHERE id = 'a1b2c3d4-e5f6-4789-a012-000000000101' AND category = 'hr';",
  "",
  "UPDATE public.document_templates SET category = 'order'",
  "WHERE id = 'a1b2c3d4-e5f6-4789-a012-000000000102' AND category = 'hr';",
  "",
  "UPDATE public.document_templates SET category = 'memo'",
  "WHERE id = 'a1b2c3d4-e5f6-4789-a012-000000000103' AND category = 'hr';",
  "",
];

for (const tpl of templates) {
  const schemaJson = JSON.stringify(tpl.schema).replace(/'/g, "''");
  lines.push(
    `INSERT INTO public.document_templates (` +
      `id, name_ru, name_kk, category, description, file_format, status, schema, default_workflow_id, allow_custom_route` +
      `) VALUES (` +
      `'${tpl.id}', ` +
      `'${tpl.name_ru.replace(/'/g, "''")}', ` +
      `'${tpl.name_kk.replace(/'/g, "''")}', ` +
      `'${tpl.category}', ` +
      `'${tpl.description.replace(/'/g, "''")}', ` +
      `'html', 'published', '${schemaJson}'::jsonb, '${tpl.default_workflow_id}', true` +
      `)`,
    `ON CONFLICT (id) DO UPDATE SET`,
    `  name_ru = EXCLUDED.name_ru,`,
    `  name_kk = EXCLUDED.name_kk,`,
    `  category = EXCLUDED.category,`,
    `  description = EXCLUDED.description,`,
    `  status = EXCLUDED.status,`,
    `  schema = EXCLUDED.schema,`,
    `  default_workflow_id = EXCLUDED.default_workflow_id,`,
    `  allow_custom_route = EXCLUDED.allow_custom_route;`,
    "",
  );
}

writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${outPath}`);
