// lab 子进程编排:laser-card 渲染管线(venv 纹理生成 + Blender/Cycles 渲染)。
// python/ 是冻结副本(与 hotaru 惯例一致);Blender 是系统二进制,解析链
// env 显式指定 -> homebrew 路径 -> PATH。渲染分钟级,由 LabJobsService
// 以 jobId + 单并发队列驱动(Blender 吃满 GPU,排队而非并行)。

import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { LocalizedError, t, type MsgKey } from "../../i18n";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { LASER_CARD_FILES, LASER_CARD_KINDS, type LabPingResponse, type LaserCardStage } from "./dto";

const execFileP = promisify(execFile);

function envNum(name: string, dflt: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : dflt;
}

// src 与 dist 的 modules/lab 同深度,watch/生产都指到 server 根
const ROOT = path.resolve(__dirname, "..", "..", "..");
export const PYTHON_DIR = path.join(ROOT, "python");
const DATA_DIR = path.join(ROOT, ".data", "lab");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const WORK_DIR = path.join(DATA_DIR, "work");

export const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);
export const IMAGE_LIMIT_BYTES = envNum("LAB_IMAGE_LIMIT_MB", 25) * 1024 * 1024;

// 15 分钟:3 pass Cycles 1080x1440 常态 1-3 分钟,给首启 Metal shader cache
// 冷编译和 CPU fallback 留足长尾
const RENDER_TIMEOUT_MS = envNum("LAB_RENDER_TIMEOUT_MS", 15 * 60_000);
const TEX_TIMEOUT_MS = envNum("LAB_TEX_TIMEOUT_MS", 60_000);

export interface LabRunResult {
  code: number | null;
  killed: boolean;
  stderrTail: string;
}

export interface LabProgress {
  stage: LaserCardStage;
  progress: number;
}

// 阶段锚点行(脚本自身的 print):textures 就绪 -> 正面完成 -> 偏角完成 ->
// 透明完成 -> GLB 导出并 patch 完成。Blender 5.2 后台模式不打样本级进度
// (--verbose 也不打,实测),所以进度只能按阶段跳变 —— 阶段文案承担过程感知
const STAGE_ANCHORS: Array<{ re: RegExp; stage: LaserCardStage; progress: number }> = [
  { re: /textures ->/, stage: "front", progress: 10 },
  { re: /wrote .*laser-card\.png$/, stage: "3d", progress: 40 },
  { re: /wrote .*laser-card-3d\.png$/, stage: "alpha", progress: 70 },
  { re: /wrote .*laser-card-alpha\.png$/, stage: "glb", progress: 90 },
  { re: /patched alphaMode/, stage: "glb", progress: 100 },
];

/** 单行 stdout -> 进度视图;非锚点行返回 null(进度停留在上一次值) */
export function parseLaserProgress(line: string): LabProgress | null {
  for (const a of STAGE_ANCHORS) {
    if (a.re.test(line)) return { stage: a.stage, progress: a.progress };
  }
  return null;
}

export interface SpawnOptions {
  cwd: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  onLine: (line: string) => void;
}

@Injectable()
export class LabService implements OnModuleDestroy {
  readonly pythonBin: string;
  readonly blenderBin: string;
  private readonly children = new Set<ChildProcess>();

  constructor() {
    // LAB_PYTHON(env 显式指定) -> 项目内 .venv(python:setup 产物) -> PATH 上的 python3
    const local = path.join(ROOT, ".venv", "bin", "python");
    this.pythonBin = process.env.LAB_PYTHON || (existsSync(local) ? local : "python3");
    // Blender 同套路,但多一级 homebrew 常驻路径:它不在 venv 里,装在哪由机器定
    const homebrew = "/opt/homebrew/bin/blender";
    this.blenderBin = process.env.LAB_BLENDER || (existsSync(homebrew) ? homebrew : "blender");
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

  /** 环境自检:解释器 + 三方库 + Blender 二进制(部署排障第一站) */
  async ping(): Promise<LabPingResponse> {
    const ok = async (cmd: string, args: string[], timeout: number) => {
      try {
        await execFileP(cmd, args, { timeout });
        return true;
      } catch {
        return false;
      }
    };
    // blender --version 也要走一遍完整启动,15s 防冷启误报
    const pythonOk = await ok(this.pythonBin, ["-c", "import numpy, PIL"], 8000);
    const blenderOk = await ok(this.blenderBin, ["--version"], 15_000);
    return { python: this.pythonBin, pythonOk, blender: this.blenderBin, blenderOk };
  }

  /**
   * laser-card 全管线:纹理(venv python) -> Cycles 三连渲 + GLB 导出(blender)。
   * 返回产物目录(固定落名已校验齐全);进度经 onProgress 流式上报。
   */
  async renderLaserCard(
    inputPath: string,
    workDir: string,
    onProgress: (p: LabProgress) => void,
  ): Promise<string> {
    const texDir = path.join(workDir, "textures");
    const outDir = path.join(workDir, "out");
    await fs.mkdir(outDir, { recursive: true });

    // 纹理阶段自身无中间输出,先报一个起点让前端立即离开"排队"文案
    onProgress({ stage: "textures", progress: 0 });
    const onLine = (line: string) => {
      const p = parseLaserProgress(line);
      if (p) onProgress(p);
    };

    const tex = await this.spawnRun(
      this.pythonBin,
      [path.join(PYTHON_DIR, "laser_textures.py"), inputPath, "-o", texDir],
      {
        cwd: PYTHON_DIR,
        timeoutMs: TEX_TIMEOUT_MS,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
        onLine,
      },
    );
    this.assertOk(tex, "lab.texFailed");

    const render = await this.spawnRun(
      this.blenderBin,
      ["-b", "-P", path.join(PYTHON_DIR, "laser_scene.py"), "--", path.join(outDir, "laser-card.png"), texDir],
      {
        cwd: PYTHON_DIR,
        timeoutMs: RENDER_TIMEOUT_MS,
        env: { ...process.env, EXPORT: "1" },
        onLine,
      },
    );
    this.assertOk(render, "lab.renderFailed");

    for (const kind of LASER_CARD_KINDS) {
      const f = LASER_CARD_FILES[kind].file;
      if (!existsSync(path.join(outDir, f))) {
        throw new LocalizedError("lab.missingArtifact", 500, { file: f });
      }
    }
    return outDir;
  }

  /** 杀掉当前所有子进程树(关停时由 jobs 先标 failed 再调用) */
  killAll(): void {
    for (const c of this.children) this.killTree(c);
  }

  onModuleDestroy(): void {
    this.killAll();
  }

  /**
   * 无 shell、参数数组的 CLI spawn。detached 建独立进程组:kill(-pid) 整组收割,
   * 不给 Blender 留孤儿。stderr 只留尾部 16KB,防巨型 traceback 涨破内存。
   */
  private spawnRun(bin: string, args: string[], opts: SpawnOptions): Promise<LabRunResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, {
        cwd: opts.cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: opts.env ?? process.env,
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
      }, opts.timeoutMs);

      child.stdout?.on("data", (c: Buffer) => {
        partial += c.toString("utf8");
        const lines = partial.split(/[\r\n]+/);
        partial = lines.pop() ?? "";
        for (const line of lines) opts.onLine(line);
      });
      child.stderr?.on("data", (c: Buffer) => {
        stderr.push(c);
        stderrLen += c.length;
        if (stderrLen > 16_384) stderrLen -= (stderr.shift() ?? { length: 0 }).length;
      });
      child.on("error", (err) => {
        // ENOENT:解释器/Blender 没了
        clearTimeout(timer);
        this.children.delete(child);
        const what = bin === this.blenderBin ? "Blender" : "Python";
        reject(new LocalizedError("proc.unavailable", 503, { what, err: err.message }));
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

  private assertOk(res: LabRunResult, whatKey: MsgKey): void {
    if (res.code === 0) return;
    const what = t(whatKey);
    if (res.killed) throw new LocalizedError("proc.timeout", 500, { what });
    const detail = res.stderrTail || t("proc.exitCode", { code: String(res.code ?? "") });
    throw new LocalizedError("proc.failed", 500, { what, detail });
  }
}
