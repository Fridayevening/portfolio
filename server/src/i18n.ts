// Backend message localization. Services throw translated strings via `t(key)`.
// The request language is captured by LangMiddleware (AsyncLocalStorage) from the
// `x-lang` header (or Accept-Language), defaulting to zh — the site's default.

import { HttpException } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

export type Lang = "zh" | "en";

const store = new AsyncLocalStorage<Lang>();

/** Run `fn` with the request language in scope (called by LangMiddleware). */
export function withLang<T>(lang: Lang, fn: () => T): T {
  return store.run(lang, fn);
}

export function getLang(): Lang {
  return store.getStore() ?? "zh";
}

const zh = {
  "db.unavailable": "数据库未连接:{e}",
  "article.notFound": "文章不存在:{id}",
  "article.badId": "非法文章 id:{id}",
  "auth.wrongPassword": "口令不对",
  "auth.tooMany": "口令试得太多次,{mins} 分钟后再来",
  "auth.ownerOnly": "需要主人权限:先解锁再操作",
  "file.notFound": "节点不存在:{id}",
  "file.notImage": "不是图片节点:{id}",
  "file.imageMissing": "图片文件缺失:{id}",
  "file.nameEmpty": "名称不能为空",
  "file.badName": "非法名称:缺少主名",
  "file.duplicate": "已有同名项目:{name}",
  "file.notInTrash": "节点不在回收站:{id}",
  "file.moveIntoSelf": "不能移动到自身或其子文件夹",
  "file.badId": "非法节点 id:{id}",
  "file.alreadyTrashed": "节点已在回收站:{id}",
  "file.badParent": "非法 parent id:{parent}",
  "file.parentMissing": "父文件夹不存在:{parent}",
  "file.newFolder": "新建文件夹",
  "file.newImage": "新建图片",
  "file.untitled": "未命名",
  "hotaru.optionsBadJson": "options 不是合法 JSON",
  "hotaru.optionsNotObject": "options 必须是 JSON 对象",

  // preferences / news
  "prefs.namespaceRequired": "至少提供一个命名空间(ui/desktop/privacy)",
  "prefs.saveUnconfirmed": "偏好保存失败:数据库未确认写入",
  "news.sourceUnavailable": "快讯源暂不可达(代理未开?)",

  // shared job / upload / process
  "job.notFound": "任务不存在或已过期",
  "job.notReady": "任务尚未完成",
  "job.queueFull": "等待队列已满({n})",
  "job.cancelled": "服务关停,任务取消",
  "upload.missingFile": "缺少 file 字段",
  "upload.badType": "不支持的文件类型,允许:{exts}",
  "proc.unavailable": "{what} 不可用:{err}",
  "proc.timeout": "{what}:处理超时",
  "proc.failed": "{what}:{detail}",
  "proc.exitCode": "退出码 {code}",

  // hotaru / lab
  "hotaru.pythonUnavailable": "Python 不可用(先跑 npm run python:setup):{err}",
  "hotaru.imageFailed": "图像处理失败",
  "hotaru.videoFailed": "视频处理失败",
  "hotaru.tooManyOutputs": "产物数量异常(期望 1,实得 {n})",
  "hotaru.tooLarge": "文件超过大小限制",
  "lab.unknownArtifact": "未知产物:{kind}",
  "lab.texFailed": "纹理生成失败",
  "lab.renderFailed": "渲染失败",
  "lab.missingArtifact": "产物缺失:{file}",
} as const;

export type MsgKey = keyof typeof zh;

const en: Record<MsgKey, string> = {
  "db.unavailable": "Database unavailable: {e}",
  "article.notFound": "Article not found: {id}",
  "article.badId": "Invalid article id: {id}",
  "auth.wrongPassword": "Wrong password",
  "auth.tooMany": "Too many attempts — try again in {mins} min",
  "auth.ownerOnly": "Owner required: unlock first",
  "file.notFound": "Node not found: {id}",
  "file.notImage": "Not an image node: {id}",
  "file.imageMissing": "Image bytes missing: {id}",
  "file.nameEmpty": "Name cannot be empty",
  "file.badName": "Invalid name: missing stem",
  "file.duplicate": "An item named {name} already exists",
  "file.notInTrash": "Node is not in the trash: {id}",
  "file.moveIntoSelf": "Cannot move into itself or a child folder",
  "file.badId": "Invalid node id: {id}",
  "file.alreadyTrashed": "Node is already in the trash: {id}",
  "file.badParent": "Invalid parent id: {parent}",
  "file.parentMissing": "Parent folder not found: {parent}",
  "file.newFolder": "New Folder",
  "file.newImage": "New Image",
  "file.untitled": "Untitled",
  "hotaru.optionsBadJson": "options is not valid JSON",
  "hotaru.optionsNotObject": "options must be a JSON object",

  "prefs.namespaceRequired": "Provide at least one namespace (ui/desktop/privacy)",
  "prefs.saveUnconfirmed": "Preferences not saved: write unconfirmed by database",
  "news.sourceUnavailable": "News sources unreachable (proxy down?)",

  "job.notFound": "Job not found or expired",
  "job.notReady": "Job not finished yet",
  "job.queueFull": "Queue full ({n})",
  "job.cancelled": "Server shutting down, job cancelled",
  "upload.missingFile": "Missing 'file' field",
  "upload.badType": "Unsupported file type; allowed: {exts}",
  "proc.unavailable": "{what} unavailable: {err}",
  "proc.timeout": "{what}: timed out",
  "proc.failed": "{what}: {detail}",
  "proc.exitCode": "exit code {code}",

  "hotaru.pythonUnavailable": "Python unavailable (run npm run python:setup first): {err}",
  "hotaru.imageFailed": "Image processing failed",
  "hotaru.videoFailed": "Video processing failed",
  "hotaru.tooManyOutputs": "Unexpected output count (expected 1, got {n})",
  "hotaru.tooLarge": "File too large",
  "lab.unknownArtifact": "Unknown artifact: {kind}",
  "lab.texFailed": "Texture generation failed",
  "lab.renderFailed": "Render failed",
  "lab.missingArtifact": "Artifact missing: {file}",
};

/** Translate a message key into the active language, with {param} interpolation. */
export function t(key: MsgKey, params?: Record<string, string | number>): string {
  const lang = getLang();
  let s = lang === "en" ? en[key] : zh[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

/** Exception translated at throw time but still carrying its key + params, so
 *  background job runners (outside the request language scope) can re-translate
 *  later. Request-scoped throws propagate as-is with the right language. */
export class LocalizedError extends HttpException {
  readonly key: MsgKey;
  readonly params?: Record<string, string | number>;
  constructor(key: MsgKey, status: number, params?: Record<string, string | number>) {
    super(t(key, params), status);
    this.key = key;
    this.params = params;
  }
}

/** Translate a stored job-error string if it is a message key (background jobs
 *  store keys; unexpected raw messages pass through untouched). */
export function translateIfKey(v: string | null): string | null {
  if (!v) return null;
  return v in zh ? t(v as MsgKey) : v;
}
