import { Module } from "@nestjs/common";
import { MarketController } from "./market.controller";
import { MarketEngineService } from "./market-engine.service";
import { StreamRegistry } from "./stream-registry.service";

@Module({
  controllers: [MarketController],
  providers: [MarketEngineService, StreamRegistry],
})
export class MarketModule {}
