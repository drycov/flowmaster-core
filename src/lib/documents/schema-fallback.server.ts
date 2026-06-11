/** PostgREST / Supabase errors when sidecar tables are not migrated yet. */
export function isSidecarSchemaMissing(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("pgrst205") ||
    m.includes("does not exist") ||
    (m.includes("could not find") && m.includes("table"))
  );
}
