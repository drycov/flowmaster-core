import {
  isOnlyOfficeJwtEnabled,
  parseOnlyOfficeCallbackPayload,
  verifyOnlyOfficeJwtToken,
  type OnlyOfficeCallbackPayload,
} from "./jwt.server";

function extractJwtToken(request: Request, rawBody: unknown): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  if (typeof rawBody === "object" && rawBody !== null && "token" in rawBody) {
    const token = (rawBody as { token: unknown }).token;
    if (typeof token === "string" && token.trim()) return token.trim();
  }

  return null;
}

function rawBodyToPayload(rawBody: unknown): OnlyOfficeCallbackPayload | null {
  if (typeof rawBody !== "object" || rawBody === null) return null;
  const body = rawBody as Record<string, unknown>;
  if ("token" in body) return null;
  return parseOnlyOfficeCallbackPayload(body);
}

/**
 * Authenticate ONLYOFFICE save callback.
 * Production: ONLYOFFICE_JWT_ENABLED=true and valid JWT required.
 */
export function verifyOnlyOfficeCallbackRequest(
  request: Request,
  rawBody: unknown,
): OnlyOfficeCallbackPayload | null {
  const production = process.env.NODE_ENV === "production";

  if (isOnlyOfficeJwtEnabled()) {
    const token = extractJwtToken(request, rawBody);
    if (!token) return null;
    const decoded = verifyOnlyOfficeJwtToken(token);
    if (!decoded) return null;
    return parseOnlyOfficeCallbackPayload(decoded);
  }

  if (production) return null;

  return rawBodyToPayload(rawBody);
}
