// lab HTTP 端点:laser-card 渲染分钟级,jobId + 轮询 + 取件三段式(同 hotaru 视频)。
// 二进制响应用 StreamableFile(Express adapter 原生支持,自动设头)—— 不学 market
// 的裸 @Res(),那是 SSE 流式协议的先例。未来新功能在本控制器加自己的路由段。

import {
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { LocalizedError } from "../../i18n";
import type { Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { UploadExceptionFilter } from "../hotaru/hotaru.controller";
import { LabJobsService } from "./lab-jobs.service";
import { IMAGE_EXTS, IMAGE_LIMIT_BYTES, LabService, UPLOADS_DIR } from "./lab.service";
import {
  LASER_CARD_FILES,
  LASER_CARD_KINDS,
  type LabPingResponse,
  type LaserCardJobResponse,
  type LaserCardKind,
  type LaserCardSubmitResponse,
} from "./dto";

// multer dest 落地文件的最小结构(与 hotaru.controller 同款,repo 不装 @types/multer)
interface MulterFile {
  path: string;
  originalname: string;
  size: number;
  mimetype: string;
}

@Controller("lab")
@UseFilters(UploadExceptionFilter)
export class LabController {
  constructor(
    private readonly runner: LabService,
    private readonly jobs: LabJobsService,
  ) {}

  /** 环境自检:解释器/三方库/Blender,部署排障第一站 */
  @Get("ping")
  ping(): Promise<LabPingResponse> {
    return this.runner.ping();
  }

  @Post("laser-card")
  @UseInterceptors(
    FileInterceptor("file", { dest: UPLOADS_DIR, limits: { fileSize: IMAGE_LIMIT_BYTES } }),
  )
  async submit(@UploadedFile() file: MulterFile | undefined): Promise<LaserCardSubmitResponse> {
    const { file: upload, ext } = this.prepare(file);
    const workDir = await this.runner.makeWorkDir(upload.path, ext);
    try {
      const jobId = this.jobs.submit(path.join(workDir, `input${ext}`), workDir);
      return { jobId };
    } catch (err) {
      // 429(队列满)等提交失败:工作目录交回自己清
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
  }

  @Get("laser-card/:jobId")
  job(@Param("jobId") jobId: string): LaserCardJobResponse {
    return this.jobs.describe(jobId);
  }

  /** PNG inline(<img>/objectURL 查看语义),GLB attachment(下载语义) */
  @Get("laser-card/:jobId/file/:kind")
  async file(
    @Param("jobId") jobId: string,
    @Param("kind") kind: string,
  ): Promise<StreamableFile> {
    if (!(LASER_CARD_KINDS as readonly string[]).includes(kind)) {
      throw new LocalizedError("lab.unknownArtifact", 400, { kind });
    }
    if (!this.jobs.has(jobId)) throw new LocalizedError("job.notFound", 404);
    const art = this.jobs.artifactOf(jobId, kind as LaserCardKind);
    if (!art) throw new LocalizedError("job.notReady", 409);
    const buf = await fs.readFile(art.file);
    const k = kind as LaserCardKind;
    const inline = art.mime.startsWith("image/");
    return new StreamableFile(buf, {
      type: art.mime,
      disposition: `${inline ? "inline" : "attachment"}; filename="${LASER_CARD_FILES[k].file}"`,
      length: buf.length,
    });
  }

  /** 校验上传文件存在 + 扩展名白名单(返回收窄后的 file,TS 过不了方法参数收窄);白名单外的临时文件顺手清掉 */
  private prepare(file: MulterFile | undefined): { file: MulterFile; ext: string } {
    if (!file) throw new LocalizedError("upload.missingFile", 400);
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!ext || !IMAGE_EXTS.has(ext)) {
      void fs.rm(file.path, { force: true }).catch(() => {});
      throw new LocalizedError("upload.badType", 400, { exts: [...IMAGE_EXTS].join(" ") });
    }
    return { file, ext };
  }
}
