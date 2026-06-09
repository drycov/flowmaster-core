import {
  isSentryEnabled,
  readSentryDsn,
  readSentryEnvironment,
  readSentryRelease,
  scrubSentryEvent,
} from "./sentry-config";

let initialized = false;

function readClientTracesSampleRate(): number {
  const raw = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE;
  const value = raw ? Number(raw) : 0;
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, 1);
}

export async function initSentryClient(): Promise<void> {
  if (initialized || typeof window === "undefined" || !isSentryEnabled("client")) return;

  const dsn = readSentryDsn("client");
  if (!dsn) return;

  const Sentry = await import("@sentry/react");
  Sentry.init({
    dsn,
    environment: readSentryEnvironment("client"),
    release: readSentryRelease("client"),
    tracesSampleRate: readClientTracesSampleRate(),
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });

  initialized = true;
}

export async function captureClientException(
  error: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  if (!initialized || typeof window === "undefined") return;
  const Sentry = await import("@sentry/react");
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }
    Sentry.captureException(error);
  });
}
