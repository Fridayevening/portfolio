import { Module } from "@nestjs/common";
import { HotaruController } from "./hotaru.controller";
import { HotaruJobsService } from "./hotaru-jobs.service";
import { HotaruService } from "./hotaru.service";

@Module({
  controllers: [HotaruController],
  providers: [HotaruService, HotaruJobsService],
})
export class HotaruModule {}
