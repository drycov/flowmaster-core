export function resolveBodyTemplate(body?: string | null): string {
  if (!body?.trim()) return "";
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { body_template?: string };
      return parsed.body_template?.trim() ?? "";
    } catch {
      return body;
    }
  }
  return body;
}
