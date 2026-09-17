// 主人之锁端点:unlock 校验口令(节流在 service);me 供前端启动时确认存量
// 令牌是否仍有效(令牌轮换后自动回锁定态)。真正的身份标记在 OwnerGuard,
// 后续请求带 x-owner-token 头即可,无需会话。

import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { OwnerGuard, type OwnerRequest } from "./owner.guard";
import { UnlockRequest } from "./dto";

@Controller("auth")
@UseGuards(OwnerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("unlock")
  unlock(@Req() req: OwnerRequest, @Body() body: UnlockRequest): { ok: true } {
    return this.auth.unlock(req.ip ?? "unknown", body.token);
  }

  @Get("me")
  me(@Req() req: OwnerRequest): { owner: boolean } {
    return { owner: req.isOwner === true };
  }
}
