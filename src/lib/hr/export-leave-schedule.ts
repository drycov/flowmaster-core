type LeaveRow = Record<string, unknown>;

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function exportLeaveScheduleCsv(
  rows: LeaveRow[],
  labels: {
    employee: string;
    type: string;
    from: string;
    to: string;
    days: string;
    status: string;
  },
  resolve: (row: LeaveRow) => {
    employee: string;
    type: string;
    from: string;
    to: string;
    days: string;
    status: string;
  },
  filenamePrefix = "leave-schedule",
) {
  const header = [labels.employee, labels.type, labels.from, labels.to, labels.days, labels.status]
    .map(csvCell)
    .join(";");

  const body = rows
    .map((row) => {
      const r = resolve(row);
      return [r.employee, r.type, r.from, r.to, r.days, r.status].map(csvCell).join(";");
    })
    .join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + header + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
