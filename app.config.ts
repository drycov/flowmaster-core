// app.config.ts или vite.config.ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
    // Отключаем предупреждение о CSRF, если мы обрабатываем его другим способом
    serverFns: {
      disableCsrfMiddlewareWarning: true, // Добавляем эту опцию
    },
  },
});