/** Docker runtime: plain JS so Vite preview does not bundle TS into node_modules/.vite-temp */
export default {
  preview: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
};
