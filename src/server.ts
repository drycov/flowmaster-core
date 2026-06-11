// entry-server.tsx
import "./lib/error-capture";
import { loadEnvFileIntoProcessEnv } from "./lib/env-file-loader.server";
import { loadServerEnv } from "./lib/env.server";
import { ensureInstallationEnv } from "./lib/installation.server";
import { logger, resolveRequestId } from "./lib/logger.server";
import { initSentryServer, captureServerException } from "./lib/observability/sentry.server";
import { applySecurityHeaders } from "./lib/observability/security-headers.server";
import { assertProductionSecurityConfig } from "./lib/production-security.server";

loadEnvFileIntoProcessEnv();
loadServerEnv();
ensureInstallationEnv();
initSentryServer();
assertProductionSecurityConfig();

void import("./lib/telegram/polling.server")
  .then((m) => {
    if (!m.shouldStartTelegramPolling()) {
      logger.info("telegram polling disabled", {
        reason:
          process.env.DISABLE_TELEGRAM_POLLING === "true"
            ? "DISABLE_TELEGRAM_POLLING"
            : "multi_replica",
      });
      return;
    }
    return m.ensureTelegramPolling();
  })
  .catch((error) => {
    logger.error("telegram polling startup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage, renderErrorPageWithDetails } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const capturedError = consumeLastCapturedError();
  logger.error("h3 swallowed SSR error", {
    body,
    error: capturedError instanceof Error ? capturedError.message : String(capturedError),
  });

  if (import.meta.env.DEV && capturedError) {
    return new Response(renderErrorPageWithDetails(capturedError), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isServerFunctionError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("Invalid server function ID") ||
      error.message.includes("server-fn-resolver") ||
      error.message.includes("createServerFn") ||
      error.message.includes("Server function")
    );
  }
  return false;
}

function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  return applySecurityHeaders(
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  );
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const requestId = resolveRequestId(request);
    const url = new URL(request.url);
    const started = Date.now();

    try {
      if (url.pathname.includes("/_server/")) {
        logger.debug("server function request", {
          request_id: requestId,
          method: request.method,
          path: url.pathname,
        });
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);

      if (response.status === 500) {
        const clonedResponse = response.clone();
        try {
          const text = await clonedResponse.text();
          if (text.includes("Invalid server function ID")) {
            logger.error("server function error in response", { request_id: requestId });
            return withRequestId(
              new Response(renderErrorPage(), {
                status: 500,
                headers: { "content-type": "text/html; charset=utf-8" },
              }),
              requestId,
            );
          }
        } catch {
          // Ignore parsing errors
        }
      }

      const normalized = await normalizeCatastrophicSsrResponse(response);

      if (url.pathname.startsWith("/api/")) {
        logger.info("api request completed", {
          request_id: requestId,
          method: request.method,
          path: url.pathname,
          status: normalized.status,
          duration_ms: Date.now() - started,
        });
      }

      return withRequestId(normalized, requestId);
    } catch (error) {
      if (isServerFunctionError(error)) {
        logger.error("server function error caught", {
          request_id: requestId,
          error: error instanceof Error ? error.message : String(error),
        });

        if (import.meta.env.DEV) {
          return withRequestId(
            new Response(renderErrorPageWithDetails(error), {
              status: 500,
              headers: { "content-type": "text/html; charset=utf-8" },
            }),
            requestId,
          );
        }

        return withRequestId(
          new Response(renderErrorPage(), {
            status: 500,
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
          requestId,
        );
      }

      logger.error("unhandled entry-server error", {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      captureServerException(error, { request_id: requestId, path: url.pathname });

      if (import.meta.env.DEV) {
        return withRequestId(
          new Response(renderErrorPageWithDetails(error), {
            status: 500,
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
          requestId,
        );
      }

      return withRequestId(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        requestId,
      );
    }
  },
};
