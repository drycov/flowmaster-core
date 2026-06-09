import { captureClientException } from "./sentry-browser";

type ErrorReportContext = Record<string, unknown>;

/** Client-side error reporting (Sentry + legacy Lovable hook). */
export async function reportClientError(
  error: unknown,
  context: ErrorReportContext = {},
): Promise<void> {
  await captureClientException(error, context);

  if (typeof window === "undefined") return;
  window.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}

declare global {
  interface Window {
    __lovableEvents?: {
      captureException?: (
        error: unknown,
        context?: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => void;
    };
  }
}
