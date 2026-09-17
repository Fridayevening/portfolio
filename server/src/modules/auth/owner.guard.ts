// 本仓库首例 guard,分两层:OwnerGuard 只标记不拦截(req.isOwner,读端点要
// "访客也放行,但 service 得知道身份");OwnerOnlyGuard 才拦(写端点 401)。
// 用法:controller 级 @UseGuards(OwnerGuard),写方法挂 @OwnerOnly()。
// Nest 执行序 controller → route 保证标记先于拦截。

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  UseGuards,
  createParamDecorator,
} from "@nestjs/common";
import type { Request } from "express";
import { OWNER_TOKEN_HEADER, isOwnerToken } from "./owner-token";
import { t } from "../../i18n";

export type OwnerRequest = Request & { isOwner?: boolean };

@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<OwnerRequest>();
    req.isOwner = isOwnerToken(req.headers[OWNER_TOKEN_HEADER]);
    return true;
  }
}

@Injectable()
export class OwnerOnlyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<OwnerRequest>();
    if (req.isOwner !== true) throw new UnauthorizedException(t("auth.ownerOnly"));
    return true;
  }
}

export const OwnerOnly = () => UseGuards(OwnerOnlyGuard);

/** 读端点把身份递进 service:GET list(@Viewer() isOwner)。 */
export const Viewer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): boolean => ctx.switchToHttp().getRequest<OwnerRequest>().isOwner === true,
);
