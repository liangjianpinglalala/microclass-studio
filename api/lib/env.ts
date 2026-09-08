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
  moonshotModel: process.env.MOONSHOT_MODEL ?? "kimi-k2.6",
  isProduction: process.env.NODE_ENV === "production",
};
