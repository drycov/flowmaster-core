/** Short-lived JWT TTL for API access (refresh token lives in HttpOnly cookie). */
export function getAccessTokenTtlSec(): number {
  const raw = process.env.ACCESS_TOKEN_TTL_MINUTES;
  const minutes = raw ? Number(raw) : 60;
  if (!Number.isFinite(minutes) || minutes < 5) {
    return 60 * 60;
  }
  return Math.min(Math.round(minutes), 24 * 60) * 60;
}
