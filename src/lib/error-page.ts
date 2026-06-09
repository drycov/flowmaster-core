// src/lib/error-page.ts

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
      .details { margin-top: 1rem; padding: 1rem; background: #f3f4f6; border-radius: 0.375rem; font-size: 0.875rem; text-align: left; overflow-x: auto; }
      .details pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}

// Экспортируем дополнительную версию с деталями ошибки для разработки
export function renderErrorPageWithDetails(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Error - FlowMaster</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 42rem; width: 100%; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 2rem; }
      h1 { font-size: 1.5rem; margin: 0 0 0.5rem; color: #dc2626; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .details { margin-top: 1.5rem; padding: 1rem; background: #f3f4f6; border-radius: 0.375rem; font-size: 0.875rem; text-align: left; overflow-x: auto; border: 1px solid #e5e7eb; }
      .details pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: monospace; font-size: 0.75rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-top: 1.5rem; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>⚠️ Application Error</h1>
      <p>Something went wrong while loading this page.</p>
      <div class="details">
        <strong>Error details:</strong>
        <pre>${escapeHtml(errorMessage)}</pre>
        ${errorStack ? `<pre style="margin-top: 0.5rem;">${escapeHtml(errorStack)}</pre>` : ""}
      </div>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(text: string): string {
  const div = document?.createElement?.("div");
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }
  // Fallback для сервера
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
