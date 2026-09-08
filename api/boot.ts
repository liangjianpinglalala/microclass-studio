import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { env } from "./lib/env";
import { scriptRoute } from "./routes/script";
import { ttsRoute } from "./routes/tts";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 5 * 1024 * 1024 }));

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    tts: Boolean(env.agentGwApiKey),
    llm: env.moonshotApiKey ? "moonshot" : "fallback",
  }),
);

app.route("/", scriptRoute);
app.route("/", ttsRoute);

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
