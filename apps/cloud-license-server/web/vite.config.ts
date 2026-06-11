import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(webRoot, "..");

function pickEnv(env: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = (env[key] ?? process.env[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

/** Vite reads .env from apps/cloud-license-server/ (not web/). */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, appRoot, "");
  const supabaseUrl = pickEnv(env, "VITE_SUPABASE_URL", "SUPABASE_URL");
  const supabaseAnon = pickEnv(env, "VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
  const licenseServerUrl = pickEnv(env, "VITE_LICENSE_SERVER_URL");
  const salesEmail = pickEnv(env, "VITE_SALES_EMAIL");

  if (mode === "production" && (supabaseUrl || supabaseAnon) && !(supabaseUrl && supabaseAnon)) {
    throw new Error(
      "Supabase web client requires both URL and anon key at build time. " +
        "Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (or SUPABASE_URL + SUPABASE_ANON_KEY) in Vercel env, then redeploy.",
    );
  }

  return {
    root: webRoot,
    envDir: appRoot,
    plugins: [react()],
    css: {
      postcss: path.join(webRoot, "postcss.config.cjs"),
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnon),
      "import.meta.env.VITE_LICENSE_SERVER_URL": JSON.stringify(licenseServerUrl),
      "import.meta.env.VITE_SALES_EMAIL": JSON.stringify(salesEmail),
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3848",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: path.join(webRoot, "dist"),
      emptyOutDir: true,
    },
  };
});
