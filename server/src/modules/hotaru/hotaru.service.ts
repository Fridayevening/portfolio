// hotaru 子进程编排:解释器解析 + CLI spawn + 进度解析 + 图像并发闸。
// python/ 是冻结副本,argparse 默认值单点在那边 —— 这里只做校验后的参数映射。
// 不预测输出文件名(Python 侧有 bmp->png、容器兜底 .mp4 等落名规则):
// 约定 outdir 运行前为空、单输入必产单文件,跑完取目录里唯一的那个。

import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { execFile } from "node:child_process";
import { LocalizedError, t, type MsgKey } from "../../i18n";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type {
  HotaruImageOptionsDto,
  HotaruJobProgress,
  HotaruPingResponse,
  HotaruVideoOptionsDto,
} from "./dto";

const execFileP = promisify(execFile);

function envNum(name: string, dflt: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : dflt;
}

// src 与 dist 的 modules/hotaru 同深度,watch/生产都指到 server 根
const ROOT = path.resolve(__dirname, "..", "..", "..");
export const PYTHON_DIR = path.join(ROOT, "python");
const DATA_DIR = path.join(ROOT, ".data", "hotaru");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const WORK_DIR = path.join(DATA_DIR, "work");

export const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);
export const VIDEO_EXTS = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".mkv",
  ".avi",
  ".webm",
  ".mpg",
  ".mpeg",
  ".ts",
]);

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
};

// 30s:典型照片亚秒到 2s,留足长尾;numpy/PIL 不至于更久
const IMAGE_TIMEOUT_MS = 30_000;
// 视频进程自身已用 ProcessPoolExecutor 吃满核,服务端不再叠超时之外的压力
export const VIDEO_TIMEOUT_MS = envNum("HOTARU_VIDEO_TIMEOUT_MS", 30 * 60_000);
export const IMAGE_LIMIT_BYTES = envNum("HOTARU_IMAGE_LIMIT_MB", 25) * 1024 * 1024;
export const VIDEO_LIMIT_BYTES = envNum("HOTARU_VIDEO_LIMIT_MB", 500) * 1024 * 1024;
const IMAGE_CONCURRENCY = envNum("HOTARU_IMAGE_CONCURRENCY", 4);

// 进度行(python/hotaru_video.py 的 _progress,flush=True):
//   "\r  <name>: frame 12/300 (4%), 8.5 fps, eta 35s   "(total 未知时省略 /total/(%)/eta)
// 锚 ": frame" —— 结束行 "(300 frames," 是复数,命不中
const PROGRESS_RE = /: frame (\d+)(?:\/(\d+))?(?: \((\d+)%\))?(?:, ([\d.]+) fps)?(?:, eta (\d+)s)?/;

export function parseProgress(line: string): HotaruJobProgress | null {
  const m = PROGRESS_RE.exec(line);
  if (!m) return null;
  const frame = Number(m[1]);
  const total = m[2] ? Number(m[2]) : null;
  return {
    frame,
    total,
    percent: m[3] ? Number(m[3]) : total ? Math.round((100 * frame) / total) : null,
    fps: m[4] ? Number(m[4]) : null,
    etaSeconds: m[5] ? Number(m[5]) : null,
  };
}

export interface HotaruRunResult {
  code: number | null;
  killed: boolean;
  stderrTail: string;
}

export interface HotaruArtifact {
  /** 产物文件绝对路径 */
  file: string;
  mime: string;
}

function baseArgs(o: HotaruImageOptionsDto | HotaruVideoOptionsDto): string[] {
  const a = [
    "--palette", o.palette,
    "--seed", String(o.seed),
    "--glow", String(o.glow),
    "--ghost", String(o.ghost),
    "--dv-shift", String(o.dvShift),
    "--haze", String(o.haze),
  ];
  // tint 缺省不传:让 Python 用 palette 各自的默认
  if (o.tint !== undefined) a.push("--tint", String(o.tint));
  if (o.invert) a.push("--invert");
  return a;
}

export function imageArgs(o: HotaruImageOptionsDto, input: string, outdir: string): string[] {
  const a = [input, "-o", outdir, "--suffix", "out", ...baseArgs(o)];
  if (o.dv) a.push("--dv", o.dv); // 图像:缺省不开
  return a;
}

export function videoArgs(o: HotaruVideoOptionsDto, input: string, outdir: string): string[] {
  return [
    input, "-o", outdir, "--suffix", "out", ...baseArgs(o),
    // 视频 dv 恒传:默认 chroma 开是视频这个"媒介"的本体
    "--dv", o.dv,
    "--dropout", String(o.dropout),
    "--grain", String(o.grain),
    "--crf", String(o.crf),
    "--width", String(o.width),
    "--height", String(o.height),
    ...(o.afterglow > 0 ? ["--afterglow", String(o.afterglow)] : []),
  ];
}

@Injectable()
export class HotaruService implements OnModuleDestroy {
  readonly pythonBin: string;
  private readonly children = new Set<ChildProcess>();
  private activeImages = 0;
  private readonly imageWaiters: Array<() => void> = [];

  constructor() {
    // HOTARU_PYTHON(env 显式指定) -> 项目内 .venv(python:setup 产物) -> PATH 上的 python3
    const local = path.join(ROOT, ".venv", "bin", "python");
    this.pythonBin = process.env.HOTARU_PYTHON || (existsSync(local) ? local : "python3");
    // multer 的 dest 目录必须先存在(2.x 不再自建)
    mkdirSync(UPLOADS_DIR, { recursive: true });
    mkdirSync(WORK_DIR, { recursive: true });
    // 上次运行留下的上传/工作目录是孤儿(任务表在内存,重启即失,404 语义):
    // TTL 清扫只认识活任务,清不到它们 —— 开机兜底扫一次
    for (const dir of [WORK_DIR, UPLOADS_DIR]) {
      void fs
        .readdir(dir)
        .then((entries) =>
          Promise.allSettled(entries.map((e) => fs.rm(path.join(dir, e), { recursive: true, force: true }))),
        )
        .catch(() => {});
    }
  }

  /** multer 落地的临时文件(无扩展名)搬进独立工作目录并恢复扩展名;用户原始文件名不进子进程 */
  async makeWorkDir(tempPath: string, ext: string): Promise<string> {
    const dir = path.join(WORK_DIR, randomUUID());
    await fs.mkdir(dir, { recursive: true });
    await fs.rename(tempPath, path.join(dir, `input${ext}`));
    return dir;
  }

  /**
   * 无 shell、参数数组的 CLI spawn。detached 建独立进程组:
   * 视频管线的 ProcessPoolExecutor worker 是孙进程,只杀父进程会留孤儿继续吃 CPU,
   * kill(-pid) 整组收割。所有参数先过 DTO 校验,到达这里只剩标量。
   */
  run(
    script: "hotaru.py" | "hotaru_video.py",
    args: string[],
    onProgress: (p: HotaruJobProgress) => void,
    timeoutMs: number,
  ): Promise<HotaruRunResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.pythonBin, [script, ...args], {
        cwd: PYTHON_DIR,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PYTHONUNBUFFERED: "1" }, // 进度 print 已 flush,这里双保险
        detached: true,
      });
      this.children.add(child);
      let partial = ""; // \r 分帧的尾巴,攒到下一个 \r/\n 再吐
      const stderr: Buffer[] = [];
      let stderrLen = 0;
      let killed = false;
      const timer = setTimeout(() => {
        killed = true;
        this.killTree(child);
      }, timeoutMs);

      child.stdout?.on("data", (c: Buffer) => {
        partial += c.toString("utf8");
        const lines = partial.split(/[\r\n]+/);
        partial = lines.pop() ?? "";
        for (const line of lines) {
          const p = parseProgress(line);
          if (p) onProgress(p);
        }
      });
      child.stderr?.on("data", (c: Buffer) => {
        stderr.push(c);
        stderrLen += c.length;
        if (stderrLen > 16_384) stderrLen -= (stderr.shift() ?? { length: 0 }).length; // 只留尾部,防巨型 traceback
      });
      child.on("error", (err) => {
        // ENOENT:解释器没了
        clearTimeout(timer);
        this.children.delete(child);
        reject(new LocalizedError("hotaru.pythonUnavailable", 503, { err: err.message }));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        this.children.delete(child);
        resolve({
          code: killed ? null : code,
          killed,
          stderrTail: Buffer.concat(stderr).toString("utf8").slice(-4000),
        });
      });
    });
  }

  /** 环境自检:解释器 + 三方库 + ffprobe(只影响竖屏视频旋转,缺失不致命但要让运维看得见) */
  async ping(): Promise<HotaruPingResponse> {
    const ok = async (cmd: string, args: string[]) => {
      try {
        await execFileP(cmd, args, { timeout: 8000 });
        return true;
      } catch {
        return false;
      }
    };
    const pythonOk = await ok(this.pythonBin, ["-c", "import numpy, PIL, av"]);
    const ffprobe = await ok("ffprobe", ["-version"]);
    return { python: this.pythonBin, pythonOk, ffprobe };
  }

  /** 图像:同步处理(典型亚秒到 2s),带并发闸 —— 单帧管线基本单线程,4 ≈ 留一半核给视频池 */
  async processImage(
    inputPath: string,
    opts: HotaruImageOptionsDto,
    workDir: string,
  ): Promise<HotaruArtifact> {
    await this.acquireImage();
    try {
      const outDir = path.join(workDir, "out");
      await fs.mkdir(outDir, { recursive: true });
      const res = await this.run("hotaru.py", imageArgs(opts, inputPath, outDir), () => {}, IMAGE_TIMEOUT_MS);
      this.assertOk(res, "hotaru.imageFailed");
      return await this.artifact(outDir);
    } finally {
      this.releaseImage();
    }
  }

  /** 视频:分钟级,由 HotaruJobsService 以 jobId + 单并发队列驱动 */
  async runVideo(
    inputPath: string,
    opts: HotaruVideoOptionsDto,
    workDir: string,
    onProgress: (p: HotaruJobProgress) => void,
  ): Promise<HotaruArtifact> {
    const outDir = path.join(workDir, "out");
    await fs.mkdir(outDir, { recursive: true });
    const res = await this.run("hotaru_video.py", videoArgs(opts, inputPath, outDir), onProgress, VIDEO_TIMEOUT_MS);
    this.assertOk(res, "hotaru.videoFailed");
    return await this.artifact(outDir);
  }

  /** 杀掉当前所有子进程树(关停时由 jobs 先标 failed 再调用) */
  killAll(): void {
    for (const c of this.children) this.killTree(c);
  }

  onModuleDestroy(): void {
    this.killAll();
  }

  private killTree(child: ChildProcess): void {
    if (!child.pid) {
      child.kill("SIGKILL");
      return;
    }
    try {
      process.kill(-child.pid, "SIGKILL"); // 负 pid = 整个进程组
    } catch {
      try {
        child.kill("SIGKILL"); // ESRCH 兜底:组已不存在
      } catch {
        // 已退出,无需处理
      }
    }
  }

  private assertOk(res: HotaruRunResult, whatKey: MsgKey): void {
    if (res.code === 0) return;
    const what = t(whatKey);
    if (res.killed) throw new LocalizedError("proc.timeout", 500, { what });
    const detail = res.stderrTail || t("proc.exitCode", { code: String(res.code ?? "") });
    throw new LocalizedError("proc.failed", 500, { what, detail });
  }

  /** 单输入必产单文件;0 或 >1 说明脚本行为变了,宁可报错不可错拿 */
  private async artifact(outDir: string): Promise<HotaruArtifact> {
    const files = (await fs.readdir(outDir)).filter((f) => !f.startsWith("."));
    if (files.length !== 1) {
      throw new LocalizedError("hotaru.tooManyOutputs", 500, { n: files.length });
    }
    const file = path.join(outDir, files[0]);
    return { file, mime: MIME_BY_EXT[path.extname(file).toLowerCase()] ?? "application/octet-stream" };
  }

  private async acquireImage(): Promise<void> {
    if (this.activeImages < IMAGE_CONCURRENCY) {
      this.activeImages++;
      return;
    }
    await new Promise<void>((resolve) => this.imageWaiters.push(resolve));
    this.activeImages++;
  }

  private releaseImage(): void {
    this.activeImages--;
    this.imageWaiters.shift()?.();
  }
}
