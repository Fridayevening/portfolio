// hotaru 契约 —— 与前端 newboy/src/lib/api/types.ts 手写对齐(docs/02 §3)。
// multipart 的 options 是 JSON 字符串,全局 ValidationPipe 罩不到这种嵌套体:
// 这里用 parseOptions() 显式 plainToInstance + validateOrReject 补位。

import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { t } from "../../i18n";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  validateOrReject,
} from "class-validator";

export const HOTARU_PALETTES = [
  "relic",
  "pool",
  "omoide",
  "liminal",
  "vapor",
  "eva",
  "original",
] as const;
export type HotaruPalette = (typeof HOTARU_PALETTES)[number];

/** 图像/视频共用风格参数。默认值 = Python argparse 默认(单点在 python/hotaru*.py,这里只做校验和传参) */
export class HotaruOptionsDto {
  @IsIn(HOTARU_PALETTES)
  palette: HotaruPalette = "relic";

  /** 随机种子:同 seed 可复现颗粒/划痕 */
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  seed = 7;

  /** 负片:反转明度 */
  @IsBoolean()
  invert = false;

  /** 辉光强度倍率 */
  @IsNumber()
  @Min(0)
  @Max(2)
  glow = 1;

  /** 残影强度 0-1.8 */
  @IsNumber()
  @Min(0)
  @Max(1.8)
  ghost = 0.15;

  /** 调色层不透明度 0-1;缺省=按 palette 默认(不传 --tint) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  tint?: number;

  /** miniDV 隔行梳齿位移像素(0=关) */
  @IsInt()
  @Min(0)
  @Max(64)
  dvShift = 4;

  /** 朦胧 veil 0-1 */
  @IsNumber()
  @Min(0)
  @Max(1)
  haze = 0;
}

export class HotaruImageOptionsDto extends HotaruOptionsDto {
  /** 图像端 miniDV:缺省=关。注意与视频端语义不同(视频默认 chroma 开),故分两个 DTO */
  @IsOptional()
  @IsIn(["chroma", "original"])
  dv?: "chroma" | "original";
}

export class HotaruVideoOptionsDto extends HotaruOptionsDto {
  /** 视频端 miniDV:默认 chroma 开(视频这个"媒介"的本体),off 才是关 */
  @IsIn(["chroma", "original", "off"])
  dv: "chroma" | "original" | "off" = "chroma";

  /** 磁带瞬闪线强度 0-5 */
  @IsNumber()
  @Min(0)
  @Max(5)
  dropout = 0.8;

  /** 前帧余晖(荧光尾迹)0-0.5 */
  @IsNumber()
  @Min(0)
  @Max(0.5)
  afterglow = 0;

  /** 颗粒强度倍率 0-1(视频体积的最大杠杆) */
  @IsNumber()
  @Min(0)
  @Max(1)
  grain = 1;

  /** 画面宽度上限 px(0=不限,只缩不放) */
  @IsInt()
  @Min(0)
  @Max(4096)
  width = 0;

  /** 画面高度上限 px(0=不限;竖屏视频的长边是高度,靠它压) */
  @IsInt()
  @Min(0)
  @Max(4096)
  height = 0;

  /** x264 质量 18-30(越小越清晰越大) */
  @IsInt()
  @Min(18)
  @Max(30)
  crf = 23;
}

// —— 响应契约 ——

export type HotaruJobStatus = "queued" | "processing" | "done" | "failed";

export interface HotaruJobProgress {
  frame: number;
  total: number | null;
  percent: number | null;
  fps: number | null;
  etaSeconds: number | null;
}

export interface HotaruSubmitResponse {
  jobId: string;
}

export interface HotaruJobResponse {
  jobId: string;
  status: HotaruJobStatus;
  progress: HotaruJobProgress | null;
  /** queued 时 = 前面还有几个任务(0 = 下一个执行);其余状态 null */
  queuePosition: number | null;
  /** failed 时 = stderr 尾部(已截断) */
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HotaruPingResponse {
  /** 实际使用的解释器路径(HOTARU_PYTHON -> 项目 .venv -> python3) */
  python: string;
  pythonOk: boolean;
  /** ffprobe 只影响竖屏视频的旋转元数据,缺失不致命 */
  ffprobe: boolean;
}

/** multipart options 字段(JSON 字符串)→ DTO;坏 JSON/坏值统一 400。
 * whitelist 剥掉未知字段(如图像端参数混进视频端),前端可以放心传超集。 */
export async function parseOptions<T extends object>(
  raw: string | undefined,
  cls: new () => T,
): Promise<T> {
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    throw new BadRequestException(t("hotaru.optionsBadJson"));
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new BadRequestException(t("hotaru.optionsNotObject"));
  }
  const dto = plainToInstance(cls, parsed);
  try {
    await validateOrReject(dto as object, { whitelist: true });
  } catch (errs) {
    // 校验错误数组作为 message 交给框架默认错误结构,和全局 ValidationPipe 的输出形状一致
    throw new BadRequestException(errs);
  }
  return dto;
}
