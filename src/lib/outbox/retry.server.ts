export const MAX_OUTBOX_ATTEMPTS = 5;

/** Exponential backoff in minutes, capped at 60 (same as webhooks). */
export function computeRetryDelayMinutes(attempts: number): number {
  return Math.min(60, Math.pow(2, Math.max(attempts, 1)));
}

export function computeNextRetryAt(attempts: number, from = Date.now()): string {
  const delayMs = computeRetryDelayMinutes(attempts) * 60_000;
  return new Date(from + delayMs).toISOString();
}

export function isOutboxExhausted(attempts: number): boolean {
  return attempts >= MAX_OUTBOX_ATTEMPTS;
}
