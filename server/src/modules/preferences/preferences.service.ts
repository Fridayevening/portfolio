// 个性化偏好的 MongoDB 存储:库 newboy,集合 preferences,单文档
// { _id: 拥有者键, ui, desktop, updatedAt }。没有 user 体系,所有读写落在
// DEFAULT_OWNER 一份文档上;接入用户后把 owner 提升到路由/鉴权层即可,集合
// 与命名空间结构不动。新分类(声音/壁纸…)作为兄弟字段并入 $set。

import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { getDb, guard } from "../db";
import { t } from "../../i18n";
import type { DesktopPrefsDto, PreferencesDto, PrivacyPrefsDto, UiPrefsDto } from "./dto";

// 单用户时代的拥有者键;user 体系落地后由鉴权层提供真实 owner。
const DEFAULT_OWNER = "default";

type PreferencesDoc = {
  _id: string;
  ui: UiPrefsDto;
  desktop: DesktopPrefsDto;
  privacy?: PrivacyPrefsDto;
  updatedAt: Date;
};

function coll() {
  return getDb().collection<PreferencesDoc>("preferences");
}

// icon id 白名单:静态桌面 id / lemonade / cola / fs-<base36> 都落在这个形状里。
const ICON_KEY_RE = /^[\w-]{1,64}$/;
const MAX_ICONS = 200;
// 4K 级上限:坐标是相对视口左上角的像素,负值/百万级都是没写过的形状。
const MAX_COORD = 100_000;

/** 深度校验 dto 校不到的 iconPos:坏条目丢弃,不整体 400 —— 布局数据宁缺毋错。 */
function sanitizeIconPos(v: unknown): Record<string, { x: number; y: number }> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  const out: Record<string, { x: number; y: number }> = {};
  for (const [k, p] of Object.entries(v).slice(0, MAX_ICONS)) {
    if (!ICON_KEY_RE.test(k)) continue;
    const x = (p as { x?: unknown })?.x;
    const y = (p as { y?: unknown })?.y;
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < 0 || y < 0 || x > MAX_COORD || y > MAX_COORD) continue;
    out[k] = { x: Math.round(x), y: Math.round(y) };
  }
  return out;
}

// 应用 id 白名单:静态桌面图标 id / market / fs-* 不在此列(文件图标的可见性
// 走 secret 字段,不走策展层)。坏条目丢弃不整体 400,同 iconPos 先例。
const APP_KEY_RE = /^[\w-]{1,64}$/;
const MAX_HIDDEN_APPS = 32;

function sanitizeHiddenApps(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const id of v.slice(0, MAX_HIDDEN_APPS)) {
    if (typeof id === "string" && APP_KEY_RE.test(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

function sanitizePrivacy(v: unknown): PrivacyPrefsDto {
  const o = (typeof v === "object" && v !== null ? v : {}) as { hiddenApps?: unknown; defaultSecret?: unknown };
  return { hiddenApps: sanitizeHiddenApps(o.hiddenApps), defaultSecret: o.defaultSecret === true };
}

function toDto(d: PreferencesDoc): PreferencesDto {
  // 老文档可能缺 desktop/privacy(早期写入的);归一成空值,契约恒定。
  return {
    ui: d.ui,
    desktop: { iconPos: sanitizeIconPos(d.desktop?.iconPos) },
    privacy: sanitizePrivacy(d.privacy),
    updatedAt: d.updatedAt.toISOString(),
  };
}

@Injectable()
export class PreferencesService {
  /** null = 服务器还没见过任何偏好(前端当 200 收 null,不当 404 处理)。 */
  async get(): Promise<PreferencesDto | null> {
    const doc = await guard(coll().findOne({ _id: DEFAULT_OWNER }));
    return doc ? toDto(doc) : null;
  }

  /** 按命名空间幂等覆盖,前端 2s 防抖批量推 —— 与稿纸自动保存同一节奏。
   *  偏好是主人意志的投影,PUT 主人专属(防访客篡改桌面,doc 08)。 */
  async save(req: { ui?: UiPrefsDto; desktop?: DesktopPrefsDto; privacy?: PrivacyPrefsDto }): Promise<PreferencesDto> {
    const set: Partial<PreferencesDoc> = { updatedAt: new Date() };
    if (req.ui) set.ui = req.ui;
    if (req.desktop) set.desktop = { iconPos: sanitizeIconPos(req.desktop.iconPos) };
    if (req.privacy) set.privacy = sanitizePrivacy(req.privacy);
    if (!req.ui && !req.desktop && !req.privacy) throw new BadRequestException(t("prefs.namespaceRequired"));

    const doc = await guard(
      coll().findOneAndUpdate({ _id: DEFAULT_OWNER }, { $set: set }, { upsert: true, returnDocument: "after" }),
    );
    // upsert + returnDocument:"after" returning null is a driver anomaly, not a
    // missing document — surface it as the database being unwell.
    if (!doc) throw new ServiceUnavailableException(t("prefs.saveUnconfirmed"));
    return toDto(doc);
  }
}
