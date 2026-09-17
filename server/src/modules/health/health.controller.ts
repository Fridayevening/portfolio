import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service";

/** 存活探测:前端启动时打它决定 LIVE/LOCAL(docs/02 §5) */
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  getStatus() {
    return this.health.getStatus();
  }
}
