// 个性化偏好端点:GET 读(无则 null,访客也要读 —— 桌面样式是共享的表演),
// PUT 全量写(主人专属:偏好是主人的桌面,不是访客的画板)。

import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { PreferencesService } from "./preferences.service";
import { OwnerGuard, OwnerOnly } from "../auth/owner.guard";
import { SavePreferencesRequest, type PreferencesDto } from "./dto";

@Controller("preferences")
@UseGuards(OwnerGuard)
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  get(): Promise<PreferencesDto | null> {
    return this.preferences.get();
  }

  @Put()
  @OwnerOnly()
  save(@Body() req: SavePreferencesRequest): Promise<PreferencesDto> {
    return this.preferences.save(req);
  }
}
