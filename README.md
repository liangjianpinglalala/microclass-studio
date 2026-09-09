# 微课坊 MicroClass Studio · 知识微课自动生成网站

输入一段知识（或上传 PPTX / PDF 课件），自动生成一节约 1 分钟的中文微课视频：
大模型撰写四段式讲解稿 → 绘制四张教学画面 → 中文真人配音 → 同步字幕 → 输出可下载的 MP4。

教育技术课程项目。

## 功能特性

- **会员注册登录**：用户名 + 密码注册（免费），scrypt 加盐哈希存储密码，httpOnly Cookie 会话（7 天有效）；未登录用户无法使用生成、配音、文件提取等全部核心接口
- **两种输入方式**：直接粘贴知识文字（≤2000 字），或上传 `.pptx` / `.pdf` 文件自动提取文字
- **内容确认**：上传文件后先展示提取到的全文（可编辑），用户确认后再生成，提取失败会明确提示原因，绝不编造内容
- **AI 讲解稿**：Moonshot 大模型生成「问题引入 → 知识解释 → 案例 → 小结」四段式中文讲解稿（未配置 API Key 时自动降级为内置模板）
- **教学画面**：Canvas 程序化绘制 1280×720 幻灯片，按讲解句自动生成字幕帧，四段配色统一版式
- **中文配音**：agent-gw 语音合成，4 种音色可选，按段合成、按句对齐字幕时间轴
- **浏览器端视频合成**：ffmpeg.wasm 在浏览器内拼接画面 + 音频 + 字幕，输出真实可播放的 MP4（H.264 + AAC），页面实时显示四阶段进度
- **学习对象适配**：小学生 / 初中生 / 高中生 / 大学生 / 成人大众，讲解稿语言风格随之调整

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 7 + Tailwind CSS 3 + Framer Motion |
| 后端 | Hono 4（`api/`，与 Vite 同端口 3000） |
| 数据库 | MySQL（Drizzle ORM，`users` + `sessions` 两张表） |
| 讲解稿 | Moonshot API（默认 kimi-k2.7-code-highspeed，JSON 模式，多模型链兜底） |
| 语音合成 | agent-gw 网关 `generate_speech` |
| 文件解析 | JSZip（PPTX）+ pdfjs-dist（PDF，含中文 CID 字体 CMap 支持） |
| 视频合成 | @ffmpeg/ffmpeg 0.12（wasm，浏览器端） |

## 本地运行

```bash
npm install
cp .env.example .env   # 填入你的密钥（见下表）
npm run dev            # 开发模式，http://localhost:3000
```

生产模式：

```bash
npm run build          # 构建前端 dist/public + 后端 dist/boot.js
npm start              # NODE_ENV=production node dist/boot.js，端口 3000
```

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `AGENT_GW_API_KEY` | 是（配音） | agent-gw 网关密钥，用于语音合成 |
| `AGENT_GW_BASE_URL` | 否 | 默认 `https://agent-gw.kimi.com/coding` |
| `MOONSHOT_API_KEY` | 否 | Moonshot 开放平台密钥；不配置时讲解稿使用内置模板降级生成 |
| `MOONSHOT_BASE_URL` | 否 | 默认 `https://api.moonshot.cn` |
| `MOONSHOT_MODEL` | 否 | 默认 `kimi-k2.7-code-highspeed` |
| `DATABASE_URL` | 是（会员功能） | MySQL 连接串，如 `mysql://user:pass@host:4000/db` |
| `PORT` | 否 | 默认 `3000` |

数据库初始化（首次运行或表结构变更后执行）：

```bash
npm run db:push    # 按 db/schema.ts 创建 users / sessions 表
```

## 部署（Render 等 Node 托管平台）

1. 推送本仓库到 GitHub
2. 在 Render 创建 **Web Service**，连接该仓库
3. Build Command：`npm install && npm run build`
4. Start Command：`npm start`
5. 在环境变量中配置 `AGENT_GW_API_KEY` 与 `MOONSHOT_API_KEY`

> 注意：语音合成依赖 agent-gw 网关，需确认你的密钥允许从部署环境访问。

## 项目结构

```
api/            # Hono 后端：/api/script（讲解稿）、/api/tts（配音）、/api/extract（文件提取）
  lib/          # 环境配置、讲解稿契约、PPTX/PDF 提取
src/
  pages/        # Home 单页（输入 → 进度 → 结果）
  components/   # FormSection、UploadPanel、PipelineSection、ResultSection 等
  lib/          # slides.ts（Canvas 画面）、video.ts（ffmpeg.wasm）、pipeline.ts（流程编排）
public/ffmpeg/  # ffmpeg.wasm 核心文件（ESM 构建）
```

## 使用提示

- 视频在浏览器端实时合成（约 2–4 分钟），生成期间请保持页面在前台
- 上传文件最大 30MB；扫描件 / 纯图片 PDF 没有文字层，无法提取，会给出明确提示

## License

MIT
