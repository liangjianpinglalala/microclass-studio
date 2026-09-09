import {
  mysqlTable,
  serial,
  varchar,
  bigint,
  timestamp,
  index,
} from "drizzle-orm/mysql-core";

/** 注册会员 */
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 128 }).notNull(),
  salt: varchar("salt", { length: 64 }).notNull(),
  displayName: varchar("display_name", { length: 64 }).notNull().default(""),
  /** user=普通会员，admin=管理员（可查看会员列表） */
  role: varchar("role", { length: 16 }).notNull().default("user"),
  /** 用户自己的 Moonshot API 密钥（AES-256-GCM 加密存储，NULL=未配置） */
  moonshotKeyEnc: varchar("moonshot_key_enc", { length: 512 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** 登录会话（httpOnly Cookie 持有 token） */
export const sessions = mysqlTable(
  "sessions",
  {
    token: varchar("token", { length: 64 }).primaryKey(),
    // FK 引用 serial() PK，必须用 bigint unsigned
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [index("idx_sessions_user").on(t.userId)],
);
