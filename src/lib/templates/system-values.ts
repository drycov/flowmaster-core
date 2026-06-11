/** System placeholder values for template substitution (DOCX/XLSX/HTML). */
export function buildSystemTemplateValues(data: {
  title_ru: string;
  title_kk?: string | null;
  reg_number?: string;
  document_subject?: string | null;
}): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10);
  const subject = (data.document_subject ?? data.title_ru).trim();
  const vals: Record<string, string> = {
    document_title: data.title_ru,
    title_ru: data.title_ru,
    title_kk: data.title_kk ?? data.title_ru,
    document_date: today,
    document_subject: subject,
  };
  if (data.reg_number) {
    vals.registration_number = data.reg_number;
    vals.reg_number = data.reg_number;
    vals.document_number = data.reg_number;
  }
  return vals;
}
