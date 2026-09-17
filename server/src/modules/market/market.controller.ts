import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { MarketEngineService } from "./market-engine.service";
import { StreamRegistry } from "./stream-registry.service";
import type { StreamEvent } from "./dto";

@Controller("market")
export class MarketController {
  constructor(
    private readonly engine: MarketEngineService,
    private readonly registry: StreamRegistry,
  ) {}

  @Get("quotes")
  async quotes() {
    // 开机首轮拉取落地前最多等 8s,免首请求拿到空表
    await this.engine.ready();
    return { at: new Date().toISOString(), quotes: this.engine.snapshot() };
  }

  // 手写 SSE 而不用 @Sse 装饰器:要发 `: ping` 注释心跳(docs/02 §8)、
  // 挂 X-Accel-Buffering 头、并精确控制断线时的订阅清理
  @Get("stream")
  stream(@Res() res: Response) {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    // 浏览器断线自动重试的等待提示
    res.write("retry: 3000\n\n");

    const send = (e: StreamEvent) => {
      res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
    };
    send({ type: "snapshot", at: new Date().toISOString(), quotes: this.engine.snapshot() });

    const events = this.engine.events$.subscribe(send);
    // 心跳注释行:防中间盒掐空闲连接;客户端 EventSource 会静默忽略
    const ping = setInterval(() => res.write(": ping\n\n"), 15_000);

    // 登记:优雅关机时由 registry 统一掐断,进程才退得干净
    this.registry.add(res);
    res.on("close", () => {
      this.registry.remove(res);
      events.unsubscribe();
      clearInterval(ping);
    });
  }
}
