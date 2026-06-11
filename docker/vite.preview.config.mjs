/** Docker production preview — full TanStack Start stack (not static-only). */
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const env = {
  ...loadEnv("development", process.cwd(), ""),
  ...loadEnv("production", process.cwd(), ""),
};

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default defineConfig({
  tanstackStart: {
    server: {
      entry: "server",
      port: 3000,
      strictPort: true,
      host: true,
      allowedHosts: true,
    },
    serverFns: {
      disableCsrfMiddlewareWarning: true,
    },
  },
  vite: {
    cacheDir: "/tmp/vite-cache",
    preview: {
      host: true,
      port: 3000,
      strictPort: true,
      allowedHosts: true,
    },
    define: {
      "process.env.SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseAnonKey),
      "process.env.SUPABASE_SERVICE_ROLE_KEY": JSON.stringify(
        env.SUPABASE_SERVICE_ROLE_KEY,
      ),
      "process.env.SUPABASE_JWT_SECRET": JSON.stringify(
        env.SUPABASE_JWT_SECRET || env.APP_SESSION_SECRET,
      ),
    },
    ssr: {
      external: ["@sentry/react"],
    },
  },
});
