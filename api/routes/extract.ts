import { Hono } from "hono";
import { extractFile, ExtractError } from "../lib/extract";

export const extractRoute = new Hono();

const MAX_SIZE = 30 * 1024 * 1024; // 30MB

extractRoute.post("/api/extract", async (c) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "请求格式不正确，请以 multipart/form-data 上传文件。" }, 400);
  }
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return c.json({ error: "未收到文件，请选择 .pptx 或 .pdf 文件上传。" }, 400);
  }
  if (file.size === 0) {
    return c.json({ error: "文件是空的，请重新选择。" }, 400);
  }
  if (file.size > MAX_SIZE) {
    return c.json({ error: "文件超过 30MB 上限，请压缩或拆分后再上传。" }, 400);
  }
  try {
    const buf = await file.arrayBuffer();
    const result = await extractFile(buf, file.name || "upload");
    return c.json({
      ...result,
      fileName: file.name,
    });
  } catch (e) {
    if (e instanceof ExtractError) {
      return c.json({ error: e.message }, e.status as 400);
    }
    console.error("[extract] 未预期的错误:", e);
    return c.json({ error: "文件解析时出现未知错误，请换一个文件试试。" }, 500);
  }
});
