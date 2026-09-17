// 个性化偏好契约:与前端 newboy/src/lib/api/types.ts 的 UiPrefs / DesktopPrefs /
// PrivacyPrefs / PreferencesResponse 对齐。文档按命名空间分组:ui(观感)、
// desktop(桌面布局)、privacy(隐私策略:访客隐藏哪些应用、新建默认公开否),
// 后续声音、壁纸等个性化分类作为兄弟命名空间加入,旧客户端不认识的字段原样
// 保留。PUT 按命名空间条件更新:请求里出现哪个命名空间就覆盖哪个,缺的不动。

import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsObject, IsOptional, IsString, Matches, ValidateNested } from "class-validator";

export interface UiPrefsDto {
  crt: boolean;
  glass: boolean;
  desktopColor: string;
}

/** 桌面图标布局:icon id → 像素坐标。fs-* 前缀是文件图标,文件删除后残键无害
 *  (前端只按现存 id 查表),不做主动清理。 */
export interface DesktopPrefsDto {
  iconPos: Record<string, { x: number; y: number }>;
}

/** 隐私策略(doc 08 §1.2,纯前端策展层的数据面):hiddenApps 是访客视角下
 *  整窗隐藏的应用 id(主人自己永远可见);defaultSecret 供前端新建内容时透传。
 *  不含任何内容本身,GET 对访客公开无泄露。 */
export interface PrivacyPrefsDto {
  hiddenApps: string[];
  defaultSecret: boolean;
}

export interface PreferencesDto {
  ui: UiPrefsDto;
  desktop: DesktopPrefsDto;
  privacy: PrivacyPrefsDto;
  /** ISO 最后保存时间;前端启动对账用它做 last-writer-wins。 */
  updatedAt: string;
}

// #rrggbb only: the settings sheet's swatch format, three/four-digit shorthand
// is not something this server ever wrote.
const HEX_RE = /^#[0-9a-f]{6}$/i;

export class UiPrefsBody {
  @IsBoolean()
  crt!: boolean;

  @IsBoolean()
  glass!: boolean;

  @Matches(HEX_RE)
  desktopColor!: string;
}

// Record 值没有可挂装饰器的类,ValidateNested 校不到叶子;深度校验由 service
// 的 sanitizeIconPos 兜底(坏条目丢弃,不整体 400)。
export class DesktopPrefsBody {
  @IsObject()
  iconPos!: Record<string, { x: number; y: number }>;
}

export class PrivacyPrefsBody {
  // 叶子正则校不到,service 的 sanitizeHiddenApps 兜底(同 iconPos 先例)。
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  hiddenApps!: string[];

  @IsBoolean()
  defaultSecret!: boolean;
}

export class SavePreferencesRequest {
  @IsOptional()
  @Type(() => UiPrefsBody)
  @ValidateNested()
  ui?: UiPrefsBody;

  @IsOptional()
  @Type(() => DesktopPrefsBody)
  @ValidateNested()
  desktop?: DesktopPrefsBody;

  @IsOptional()
  @Type(() => PrivacyPrefsBody)
  @ValidateNested()
  privacy?: PrivacyPrefsBody;
}
