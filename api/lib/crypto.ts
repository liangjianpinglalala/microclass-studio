import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

/**
 * 用户 Moonshot 密钥的静态加密（AES-256-GCM）
 * 主密钥由 APP_SECRET 经 SHA-256 派生；明文密钥绝不入库、绝不通过接口返回
 */

function masterKey(): Buffer {
  return createHash("sha256").update(env.appSecret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 格式：iv(12B) | tag(16B) | ciphertext → base64
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(packed: string): string {
  const buf = Buffer.from(packed, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
