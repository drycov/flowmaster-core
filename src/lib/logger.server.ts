import { randomUUID } from "node:crypto";
import { captureServerException } from "@/lib/observability/sentry.server";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const threshold = LOG_LEVELS[minLevel()];

function write(level: LogLevel, message: string, fields?: LogFields): void {
  if (LOG_LEVELS[level] < threshold) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    const err = fields?.err ?? fields?.error;
    if (err instanceof Error) {
      captureServerException(err, fields);
    }
  } else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};

export function resolveRequestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || randomUUID();
}
