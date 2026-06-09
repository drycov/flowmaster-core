import * as Sentry from "@sentry/node";

import {
  isSentryEnabled,
  readSentryDsn,
  readSentryEnvironment,
  readSentryRelease,
  scrubSentryEvent,
} from "./sentry-config";

let initialized = false;

function readServerTracesSampleRate(): number {
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE;
  const value = raw ? Number(raw) : 0;
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, 1);
}

export function initSentryServer(): void {
  if (initialized || !isSentryEnabled("server")) return;

  const dsn = readSentryDsn("server");
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: readSentryEnvironment("server"),
    release: readSentryRelease("server"),
    tracesSampleRate: readServerTracesSampleRate(),
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });

  initialized = true;
}

export function captureServerException(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }
    Sentry.captureException(error);
  });
}

export function captureServerMessage(
  message: string,
  context: Record<string, unknown> = {},
): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }
    Sentry.captureMessage(message, "error");
  });
}
