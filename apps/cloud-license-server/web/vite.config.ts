import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: webRoot,
  plugins: [react()],
  css: {
    postcss: path.join(webRoot, "postcss.config.cjs"),
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
});
