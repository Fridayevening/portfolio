// 主人令牌的常量时间校验:所有"是不是主人"的判定都收敛在这里(docs/08 §1.3)。
// OWNER_TOKEN 未配置 = fail-closed(谁都不是主人,写接口全 401);启动警告在
// AuthService.onModuleInit。令牌只进服务端 env,永不进前端仓库(doc 02 铁律 2)。

import { createHash, timingSafeEqual } from "node:crypto";

export const OWNER_TOKEN_HEADER = "x-owner-token";

// 8 位下限挡住 "1"/"test" 这类占位值 —— 那和没配一样。
export function ownerTokenConfigured(): boolean {
  const t = process.env.OWNER_TOKEN;
  return typeof t === "string" && t.length >= 8;
}

/** sha256 归一长度后 timingSafeEqual:比较耗时与口令内容无关。 */
export function isOwnerToken(candidate: unknown): boolean {
  if (!ownerTokenConfigured() || typeof candidate !== "string" || !candidate) return false;
  const expect = createHash("sha256").update(String(process.env.OWNER_TOKEN)).digest();
  const given = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expect, given);
}
