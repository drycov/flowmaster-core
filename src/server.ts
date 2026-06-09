// entry-server.tsx
import "./lib/error-capture";
import { loadServerEnv } from "./lib/env.server";

loadServerEnv();

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
  console.error(capturedError ?? new Error(`h3 swallowed SSR error: ${body}`));
  
  // В режиме разработки показываем детали
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
    return error.message.includes('Invalid server function ID') ||
           error.message.includes('server-fn-resolver') ||
           error.message.includes('createServerFn') ||
           error.message.includes('Server function');
  }
  return false;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      
      if (url.pathname.includes('/_server/')) {
        console.log(`[Server Function] ${request.method} ${url.pathname}`);
      }
      
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      
      if (response.status === 500) {
        const clonedResponse = response.clone();
        try {
          const text = await clonedResponse.text();
          if (text.includes('Invalid server function ID')) {
            console.error('Server function error detected in response');
            return new Response(renderErrorPage(), {
              status: 500,
              headers: { "content-type": "text/html; charset=utf-8" },
            });
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      if (isServerFunctionError(error)) {
        console.error('Server function error caught:', error);
        
        if (import.meta.env.DEV) {
          return new Response(renderErrorPageWithDetails(error), {
            status: 500,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        
        return new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      
      console.error('Unhandled error in entry-server:', error);
      
      if (import.meta.env.DEV) {
        return new Response(renderErrorPageWithDetails(error), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};