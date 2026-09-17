// hotaru HTTP 端点:图像同步返回二进制(典型亚秒到 2s,无状态最省事);
// 视频分钟级,jobId + 轮询 + 下载三段式。二进制响应用 StreamableFile
// (Express adapter 原生支持,自动设头)—— 不学 market 的裸 @Res(),那是 SSE 流式协议的先例。

import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { LocalizedError, t } from "../../i18n";
import type { Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { HotaruJobsService } from "./hotaru-jobs.service";
import {
  HotaruService,
  IMAGE_EXTS,
  IMAGE_LIMIT_BYTES,
  UPLOADS_DIR,
  VIDEO_EXTS,
  VIDEO_LIMIT_BYTES,
} from "./hotaru.service";
import {
  HotaruImageOptionsDto,
  HotaruJobResponse,
  HotaruPingResponse,
  HotaruSubmitResponse,
  HotaruVideoOptionsDto,
  parseOptions,
} from "./dto";

// multer dest 落地文件的最小结构(repo 不装 @types/multer,NestJS 12 的 multer
// options 本身就是内联结构化类型,这四个字段是我们用到的全部)
interface MulterFile {
  path: string;
  originalname: string;
  size: number;
  mimetype: string;
}

// multer 的 LIMIT_FILE_SIZE 默认冒成 500;按 err.code 鸭子判断映射 413,
// 不 import 无类型的 MulterError。其余错误按框架默认结构复刻(controller 级
// catch-all 会顶掉全局处理,所以 HttpException 分支手工还原默认形状)。
@Catch()
export class UploadExceptionFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if ((err as { code?: string } | null)?.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ statusCode: 413, message: t("hotaru.tooLarge") });
      return;
    }
    if (err instanceof HttpException) {
      const body = err.getResponse();
      res
        .status(err.getStatus())
        .json(typeof body === "string" ? { statusCode: err.getStatus(), message: body } : body);
      return;
    }
    console.error("[hotaru] 未处理错误:", err);
    res.status(500).json({ statusCode: 500, message: "Internal server error" });
  }
}

@Controller("hotaru")
@UseFilters(UploadExceptionFilter)
export class HotaruController {
  constructor(
    private readonly runner: HotaruService,
    private readonly jobs: HotaruJobsService,
  ) {}

  /** 环境自检:解释器/三方库/ffprobe,部署排障第一站 */
  @Get("ping")
  ping(): Promise<HotaruPingResponse> {
    return this.runner.ping();
  }

  @Post("image")
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor("file", { dest: UPLOADS_DIR, limits: { fileSize: IMAGE_LIMIT_BYTES } }),
  )
  async image(
    @UploadedFile() file: MulterFile | undefined,
    @Body("options") options?: string,
  ): Promise<StreamableFile> {
    const { file: upload, ext } = this.prepare(file, IMAGE_EXTS);
    const opts = await parseOptions(options, HotaruImageOptionsDto);
    const workDir = await this.runner.makeWorkDir(upload.path, ext);
    try {
      const art = await this.runner.processImage(path.join(workDir, `input${ext}`), opts, workDir);
      const buf = await fs.readFile(art.file);
      return new StreamableFile(buf, {
        type: art.mime,
        disposition: `attachment; filename="hotaru${path.extname(art.file)}"`,
        length: buf.length,
      });
    } finally {
      // 产物已读进内存,工作目录即用即清
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }

  @Post("video")
  @UseInterceptors(
    FileInterceptor("file", { dest: UPLOADS_DIR, limits: { fileSize: VIDEO_LIMIT_BYTES } }),
  )
  async video(
    @UploadedFile() file: MulterFile | undefined,
    @Body("options") options?: string,
  ): Promise<HotaruSubmitResponse> {
    const { file: upload, ext } = this.prepare(file, VIDEO_EXTS);
    const opts = await parseOptions(options, HotaruVideoOptionsDto);
    const workDir = await this.runner.makeWorkDir(upload.path, ext);
    try {
      const jobId = this.jobs.submit(path.join(workDir, `input${ext}`), opts, workDir);
      return { jobId };
    } catch (err) {
      // 429(队列满)等提交失败:工作目录交回自己清
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
  }

  @Get("video/:jobId")
  job(@Param("jobId") jobId: string): HotaruJobResponse {
    return this.jobs.describe(jobId);
  }

  @Get("video/:jobId/download")
  async download(@Param("jobId") jobId: string): Promise<StreamableFile> {
    if (!this.jobs.has(jobId)) throw new LocalizedError("job.notFound", 404);
    const art = this.jobs.artifactOf(jobId);
    if (!art) throw new LocalizedError("job.notReady", 409);
    const buf = await fs.readFile(art.file);
    return new StreamableFile(buf, {
      type: art.mime,
      disposition: `attachment; filename="hotaru${path.extname(art.file)}"`,
      length: buf.length,
    });
  }

  /** 校验上传文件存在 + 扩展名白名单(返回收窄后的 file,TS 过不了方法参数收窄);白名单外的临时文件顺手清掉 */
  private prepare(file: MulterFile | undefined, exts: Set<string>): { file: MulterFile; ext: string } {
    if (!file) throw new LocalizedError("upload.missingFile", 400);
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!ext || !exts.has(ext)) {
      void fs.rm(file.path, { force: true }).catch(() => {});
      throw new LocalizedError("upload.badType", 400, { exts: [...exts].join(" ") });
    }
    return { file, ext };
  }
}
