import { Module } from "@nestjs/common";
import { LabController } from "./lab.controller";
import { LabJobsService } from "./lab-jobs.service";
import { LabService } from "./lab.service";

@Module({
  controllers: [LabController],
  providers: [LabService, LabJobsService],
})
export class LabModule {}
