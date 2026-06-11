import { existsSync, readFileSync } from "node:fs";

/** Parse KEY=value pairs (ignores comments and blank lines). */
export function parseEnvValues(text) {
  const values = new Map();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    values.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return values;
}

export function loadEnvValues(paths) {
  const merged = new Map();
  for (const path of paths) {
    if (!path || !existsSync(path)) continue;
    for (const [key, value] of parseEnvValues(readFileSync(path, "utf8"))) {
      if (value.length > 0) merged.set(key, value);
    }
  }
  return merged;
}

/** Apply values onto template lines, preserving comments and section order. */
export function renderEnvFromTemplate(templateContent, values) {
  const seen = new Set();
  const lines = templateContent.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq);
    if (!values.has(key)) return line;
    seen.add(key);
    const indent = line.match(/^(\s*)/)?.[1] ?? "";
    return `${indent}${key}=${values.get(key)}`;
  });

  const extra = [];
  for (const [key, value] of values) {
    if (!seen.has(key)) extra.push(`${key}=${value}`);
  }
  if (extra.length > 0) {
    lines.push("", "# ── Дополнительно (сгенерировано) ──", ...extra);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function toEnvMap(source) {
  if (source instanceof Map) return source;
  if (source && typeof source === "object") {
    return new Map(Object.entries(source));
  }
  return new Map();
}

export function mergeEnvMaps(...sources) {
  const out = new Map();
  for (const source of sources) {
    for (const [key, value] of toEnvMap(source)) {
      if (value !== undefined && value !== null && String(value).length > 0) {
        out.set(key, String(value));
      }
    }
  }
  return out;
}
