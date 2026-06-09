import type { EdmsReports } from "@/lib/api/reports.functions";

function escapeCsv(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function reportsToCsv(data: EdmsReports, locale: "ru" | "kk"): string {
  const typeName = (row: { name_ru: string; name_kk: string }) =>
    locale === "kk" ? row.name_kk : row.name_ru;

  const lines: string[] = [
    "section,key,value",
    `meta,period_days,${data.period_days}`,
    `meta,generated_at,${escapeCsv(data.generated_at)}`,
    `totals,documents,${data.totals.documents}`,
    `totals,created_in_period,${data.totals.created_in_period}`,
  ];

  for (const row of data.documents_by_status) {
    lines.push(`status,${escapeCsv(row.status)},${row.count}`);
  }
  for (const row of data.documents_by_type) {
    lines.push(`type,${escapeCsv(typeName(row))},${row.count}`);
  }
  for (const row of data.documents_timeline) {
    lines.push(`timeline,${row.day},${row.count}`);
  }

  lines.push(`sla,ok,${data.sla_summary.ok}`);
  lines.push(`sla,warning,${data.sla_summary.warning}`);
  lines.push(`sla,overdue,${data.sla_summary.overdue}`);
  lines.push(`correspondence,incoming,${data.correspondence.incoming}`);
  lines.push(`correspondence,outgoing,${data.correspondence.outgoing}`);
  lines.push(`archive,archived,${data.archive.archived}`);
  lines.push(`archive,legal_hold,${data.archive.legal_hold}`);

  return lines.join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
