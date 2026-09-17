// 视频任务表:内存 Map + FIFO 队列,并发 1。
// 视频进程自身已用 ProcessPoolExecutor 吃满核,服务端排队等待是正确行为,不叠加并行视频。
// 任务表在内存:重启即失,404 就是"不存在或已过期"的语义,不持久化(私有单实例,YAGNI)。

import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { LocalizedError, translateIfKey } from "../../i18n";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { HotaruService } from "./hotaru.service";
import type { HotaruJobResponse, HotaruJobStatus, HotaruVideoOptionsDto } from "./dto";

const QUEUE_LIMIT = 8; // 等待队列上限:防前端狂提交把磁盘和内存吃穿
const SWEEP_MS = 60_000;
// done/failed 的保留期:够取件 + 复查,过期删记录连工作目录一起清
const JOB_TTL_MS = Number(process.env.HOTARU_JOB_TTL_MS) > 0
  ? Number(process.env.HOTARU_JOB_TTL_MS)
  : 30 * 60_000;

interface HotaruJob {
  jobId: string;
  status: HotaruJobStatus;
  progress: HotaruJobResponse["progress"];
  error: string | null;
  workDir: string;
  inputPath: string;
  opts: HotaruVideoOptionsDto;
  outPath: string | null;
  outMime: string;
  createdAt: string;
  updatedAt: string;
}

const nowIso = () => new Date().toISOString();

@Injectable()
export class HotaruJobsService implements OnModuleDestroy {
  private readonly jobs = new Map<string, HotaruJob>();
  private readonly queue: string[] = [];
  private current: string | null = null;
  private readonly sweeper: NodeJS.Timeout;
  private shuttingDown = false;

  constructor(private readonly runner: HotaruService) {
    this.sweeper = setInterval(() => void this.sweep(), SWEEP_MS);
    this.sweeper.unref(); // 定时器不拖住进程退出(关停路径另有 onModuleDestroy 兜底)
  }

  /** 排队一个视频任务;等待队列满抛 429 */
  submit(inputPath: string, opts: HotaruVideoOptionsDto, workDir: string): string {
    if (this.queue.length >= QUEUE_LIMIT) {
      // Nest 无内置 429 异常类,直接 HttpException 带状态码
      throw new LocalizedError("job.queueFull", 429, { n: QUEUE_LIMIT });
    }
    const jobId = crypto.randomUUID();
    this.jobs.set(jobId, {
      jobId,
      status: "queued",
      progress: null,
      error: null,
      workDir,
      inputPath,
      opts,
      outPath: null,
      outMime: "application/octet-stream",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.queue.push(jobId);
    this.pump();
    return jobId;
  }

  /** 轮询用状态视图;不存在/已过期 → 404(前端把 404 当过期处理) */
  describe(jobId: string): HotaruJobResponse {
    const job = this.jobs.get(jobId);
    if (!job) throw new LocalizedError("job.notFound", 404);
    return {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      queuePosition: job.status === "queued" ? this.queue.indexOf(jobId) : null,
      error: translateIfKey(job.error),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  /** 取 done 任务的产物路径 + MIME;不存在/未完成由调用方判 404/409 */
  artifactOf(jobId: string): { file: string; mime: string } | null {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "done" || !job.outPath) return null;
    return { file: job.outPath, mime: job.outMime };
  }

  has(jobId: string): boolean {
    return this.jobs.has(jobId);
  }

  onModuleDestroy(): void {
    this.shuttingDown = true;
    clearInterval(this.sweeper);
    const cancel = (job: HotaruJob) => {
      job.status = "failed";
      job.error = "job.cancelled";
      job.updatedAt = nowIso();
    };
    for (const id of this.queue) {
      const job = this.jobs.get(id);
      if (job) cancel(job);
    }
    this.queue.length = 0;
    if (this.current) {
      const job = this.jobs.get(this.current);
      if (job) cancel(job);
      this.current = null;
    }
    // 先标 failed 再杀树:孙进程 worker 不留孤儿(依赖 provider 先于本 service 销毁,
    // jobs 依赖 runner,Nest 按"被依赖者后销毁"排序,这里主动杀而不是等 runner 的 destroy)
    this.runner.killAll();
  }

  private pump(): void {
    if (this.shuttingDown || this.current || this.queue.length === 0) return;
    const jobId = this.queue.shift()!;
    const job = this.jobs.get(jobId);
    if (!job) {
      this.pump();
      return;
    }
    this.current = jobId;
    job.status = "processing";
    job.updatedAt = nowIso();
    void this.runner
      .runVideo(job.inputPath, job.opts, job.workDir, (p) => {
        job.progress = p;
      })
      .then((art) => {
        // 关停竞态:jobs 先把任务标 failed,迟到的成功不覆盖
        if (job.status !== "processing") return;
        job.status = "done";
        job.outPath = art.file;
        job.outMime = art.mime;
        job.updatedAt = nowIso();
      })
      .catch((err: unknown) => {
        if (job.status !== "processing") return;
        job.status = "failed";
        job.error = err instanceof LocalizedError ? err.key : err instanceof Error ? err.message : String(err);
        job.updatedAt = nowIso();
      })
      .finally(() => {
        this.current = null;
        this.pump();
      });
  }

  /** TTL 清扫:done/failed 超期 → 删记录 + 删工作目录(之后 describe 返回 404) */
  private async sweep(): Promise<void> {
    const now = Date.now();
    for (const job of this.jobs.values()) {
      if (job.status !== "done" && job.status !== "failed") continue;
      if (now - Date.parse(job.updatedAt) < JOB_TTL_MS) continue;
      this.jobs.delete(job.jobId);
      await fs.rm(job.workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
