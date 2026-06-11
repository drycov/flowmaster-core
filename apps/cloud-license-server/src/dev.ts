import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3848);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Cloud license server http://127.0.0.1:${port}`);
});
