# 微课坊 MicroClass Studio · 知识微课自动生成网站

输入一段知识内容，自动生成一节约 1 分钟的中文微课 MP4：
**讲解稿（问题引入/知识解释/案例/小结）→ 中文配音 → 四张统一版式教学画面 → 逐句字幕 → 可下载 MP4**。

## 工作原理

| 环节 | 实现方式 |
|------|----------|
| 讲解稿生成 | 后端 `POST /api/script` → Moonshot 大模型（`moonshot-v1-8k`）；未配置密钥时自动使用内置模板降级生成 |
| 中文配音 | 后端 `POST /api/tts` → 平台 agent-gw 语音合成（4 种中文音色可选），后端代理返回 mp3 |
| 教学画面 | 浏览器 Canvas 程序绘制 1280×720（统一版式、清晰中文文字，不依赖 AI 生图） |
| 字幕 | 按配音逐句对齐，直接烧录进视频画面 |
| MP4 合成 | 浏览器端 ffmpeg.wasm（h264 + aac），无需服务器安装 ffmpeg |

前端：React 19 + Vite + Tailwind；后端：Hono（`api/`，仅作密钥代理与脚本生成）。

## 配置（.env，部署环境的环境变量同理）

```bash
# 必填：平台语音合成网关（沙箱/部署凭证）
AGENT_GW_API_KEY=sk-...
AGENT_GW_BASE_URL=https://agent-gw.kimi.com/coding

# 强烈建议：Moonshot 开放平台 API Key（https://platform.moonshot.cn 免费注册创建）
# 不填也能用，但讲解稿由内置模板生成，质量明显低于大模型
MOONSHOT_API_KEY=
MOONSHOT_BASE_URL=https://api.moonshot.cn
MOONSHOT_MODEL=moonshot-v1-8k
```

## 本地运行

```bash
npm install
npm run dev     # http://localhost:3000
# 生产：npm run build && npm start
```

## 使用提示

- 生成过程约 2-4 分钟（浏览器内完成视频合成），**请保持标签页在前台打开**，切走或息屏可能中断合成。
- 第一版仅支持文字输入；文件上传、数字人、复杂动画未包含。
