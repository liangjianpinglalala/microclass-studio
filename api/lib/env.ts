import "dotenv/config";

export const env = {
  /** agent-gw 网关（语音合成等） */
  agentGwApiKey: process.env.AGENT_GW_API_KEY ?? "",
  agentGwBaseUrl: (
    process.env.AGENT_GW_BASE_URL ?? "https://agent-gw.kimi.com/coding"
  ).replace(/\/+$/, ""),
  /** Moonshot 开放平台（讲解稿生成，可选——缺失时使用内置模板降级） */
  moonshotApiKey: process.env.MOONSHOT_API_KEY ?? "",
  moonshotBaseUrl: (
    process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.cn"
  ).replace(/\/+$/, ""),
  moonshotModel: process.env.MOONSHOT_MODEL ?? "kimi-k2.7-code-highspeed",
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** 用户密钥加解密主密钥（平台下发；本地开发缺失时回退到固定派生源，仅影响加密结果） */
  appSecret: process.env.APP_SECRET ?? "microclass-local-dev-secret",
};
