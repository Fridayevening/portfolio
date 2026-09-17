import { Injectable } from "@nestjs/common";

/** 与前端 newboy/src/lib/api/types.ts 的 HealthResponse 对齐 */
export interface HealthResponse {
  service: string;
  status: string;
  uptime: number;
  timestamp: string;
}

@Injectable()
export class HealthService {
  getStatus(): HealthResponse {
    return {
      service: "newboy-server",
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
