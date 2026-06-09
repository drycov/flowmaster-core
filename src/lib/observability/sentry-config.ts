export type SentryRuntime = "server" | "client";

const SENSITIVE_KEYS = /password|secret|token|authorization|cookie|api[_-]?key/i;

export function readSentryDsn(runtime: SentryRuntime): string | undefined {
  if (runtime === "client") {
    return (
      import.meta.env.VITE_SENTRY_DSN?.trim() ||
      import.meta.env.VITE_PUBLIC_SENTRY_DSN?.trim() ||
      undefined
    );
  }
  return process.env.SENTRY_DSN?.trim() || undefined;
}

export function isSentryEnabled(runtime: SentryRuntime): boolean {
  return Boolean(readSentryDsn(runtime));
}

export function readSentryEnvironment(runtime: SentryRuntime): string {
  if (runtime === "client") {
    return import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE || "development";
  }
  return process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";
}

export function readSentryRelease(runtime: SentryRuntime): string | undefined {
  if (runtime === "client") {
    return import.meta.env.VITE_SENTRY_RELEASE?.trim() || undefined;
  }
  return process.env.SENTRY_RELEASE?.trim() || undefined;
}

export function readTracesSampleRate(): number {
  const raw =
    process.env.SENTRY_TRACES_SAMPLE_RATE ?? import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE;
  const value = raw ? Number(raw) : 0;
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, 1);
}

export function scrubSentryEvent<T extends { extra?: Record<string, unknown> }>(event: T): T {
  if (!event.extra) return event;
  const extra = { ...event.extra };
  for (const key of Object.keys(extra)) {
    if (SENSITIVE_KEYS.test(key)) {
      extra[key] = "[Filtered]";
    }
  }
  return { ...event, extra };
}
