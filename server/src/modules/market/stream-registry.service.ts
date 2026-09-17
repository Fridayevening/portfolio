import { Injectable, OnModuleDestroy } from "@nestjs/common";
import type { Response } from "express";

// 在册 API:活着的 SSE 响应。
// enableShutdownHooks 的优雅关机会等所有连接自然结束 —— 而浏览器侧的
// EventSource 断线只会无限重连,不会主动断开,SIGTERM 后进程就僵着
// 「装死继续推流」(实测踩坑:杀掉后 3s 进程仍在、SSE 照常出数)。
// 这里在模块销毁时主动 end() 全部流,让进程干脆退出。
@Injectable()
export class StreamRegistry implements OnModuleDestroy {
  private readonly streams = new Set<Response>();

  add(res: Response): void {
    this.streams.add(res);
  }

  remove(res: Response): void {
    this.streams.delete(res);
  }

  onModuleDestroy(): void {
    for (const res of this.streams) res.end();
    this.streams.clear();
  }
}
