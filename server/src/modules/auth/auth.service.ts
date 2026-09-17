// 解锁的失败节流:每 IP 连错 MAX_FAILS 次锁 LOCK_MS。进程内 Map 够用 ——
// 单进程部署,重启清零;这是 doc 02 末段"公开写口必须限流"的第一笔兑现,
// 将来接 redis 再升级,接口不变。

import { Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { isOwnerToken, ownerTokenConfigured } from "./owner-token";
import { t } from "../../i18n";

const MAX_FAILS = 10;
const LOCK_MS = 10 * 60_000;

type Attempt = { fails: number; lockedUntil: number };

@Injectable()
export class AuthService implements OnModuleInit {
  private attempts = new Map<string, Attempt>();

  onModuleInit() {
    if (!ownerTokenConfigured()) {
      console.warn(
        "auth: OWNER_TOKEN 未配置 —— fail-closed:解锁必然失败,全部写接口 401。请在服务端 .env 设置 OWNER_TOKEN(≥8 位)。",
      );
    }
  }

  unlock(ip: string, token: string): { ok: true } {
    const now = Date.now();
    const a = this.attempts.get(ip);
    if (a?.lockedUntil && a.lockedUntil > now) {
      const mins = Math.ceil((a.lockedUntil - now) / 60_000);
      throw new UnauthorizedException(t("auth.tooMany", { mins }));
    }
    if (isOwnerToken(token)) {
      this.attempts.delete(ip);
      return { ok: true };
    }
    const next: Attempt = { fails: (a?.fails ?? 0) + 1, lockedUntil: 0 };
    if (next.fails >= MAX_FAILS) {
      next.lockedUntil = now + LOCK_MS;
      next.fails = 0;
    }
    this.attempts.set(ip, next);
    throw new UnauthorizedException(t("auth.wrongPassword"));
  }
}
