import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { env } from "./lib/env";
import { scriptRoute } from "./routes/script";
import { ttsRoute } from "./routes/tts";
import { extractRoute } from "./routes/extract";
import { authRoute, requireAuth } from "./routes/auth";

const app = new Hono<{ Bindings: HttpBindings }>();

// 仅文件上传接口需要大 body 限制（全局挂载会导致无 body 的 POST 在 dev-server 下崩溃）
app.use("/api/extract", bodyLimit({ maxSize: 35 * 1024 * 1024 }));

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    tts: Boolean(env.agentGwApiKey),
    llm: env.moonshotApiKey ? "moonshot" : "fallback",
  }),
);

// 会员制：生成类接口必须先登录
app.use("/api/script", requireAuth);
app.use("/api/script/*", requireAuth);
app.use("/api/tts", requireAuth);
app.use("/api/extract", requireAuth);

app.route("/", authRoute);
app.route("/", scriptRoute);
app.route("/", ttsRoute);
app.route("/", extractRoute);

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
