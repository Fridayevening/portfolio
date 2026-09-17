// 桌面文件系统节点:库 newboy,集合 files,文档
// {_id, type, name, parent, articleId, ext, mime, size, createdAt, updatedAt,
//  deletedAt?}。三种节点 —— folder 纯元数据;doc 挂 articles(articleId 引用,
// 文稿的正文与自动保存全部复用 articles 模块);image 的二进制放
// .data/files/<id><ext>,本期是占位图(assets/placeholder.png 拷贝)。
// 命名与去重全在服务端(桌面右键与将来的统一入口共用一条路径)。
// 删除是软删(deletedAt 置时,缺字段 = 存活):回收站保留 TRASH_DAYS 天,
// 到期由定时 + 启动补扫彻底清除(连带文章与图片字节)。节点进回收站后
// parent 不可变 —— 恢复目标就是原 parent(已不在则回桌面),不另存原位置。

import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { copyFile, mkdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Cron } from "@nestjs/schedule";
import { ArticlesService } from "../articles/articles.service";
import { ID_RE, getDb, guard, newId } from "../db";
import { t } from "../../i18n";
import { hiddenFromVisitors, nodeHiddenFromVisitors } from "../visibility";
import type {
  CreateFsNodeRequest,
  FsNodeDto,
  FsParentRequest,
  RenameFsNodeRequest,
  TrashItemDto,
  TrashResponse,
  FsType,
} from "./dto";

// src/modules/files → repo root: identical under watch/dev/dist (hotaru precedent).
const ROOT = path.resolve(__dirname, "..", "..", "..");
const FILES_DIR = path.join(ROOT, ".data", "files");
const PLACEHOLDER = path.join(ROOT, "assets", "placeholder.png");

const UNTITLED_RE = /^(?:未命名|Untitled)-(\d+)\.md$/;

// Module-scope env read is safe (env.ts is main.ts's first import, news @Cron
// precedent); NaN/0/empty fall back to the default.
const TRASH_DAYS = Number(process.env.FILES_TRASH_DAYS) || 7;
const TRASH_RETAIN_MS = TRASH_DAYS * 86_400_000;

type FileDoc = {
  _id: string;
  type: FsType;
  name: string;
  parent: string | null;
  articleId: string | null;
  ext: string | null;
  mime: string | null;
  size: number | null;
  createdAt: Date;
  updatedAt: Date;
  /** 软删时间;缺字段 = 存活(Mongo 的 null 等值查询同时命中缺失)。 */
  deletedAt?: Date | null;
  /** 私密标记(doc 08):true = 访客不可见(读侧沿祖先链级联判定);null/缺省 = 公开。 */
  secret?: boolean | null;
};

/** copy 用的存活子树快照:先收集后落库,拷进自身子树也是这份快照的克隆。 */
type TreeDoc = { doc: FileDoc; children: TreeDoc[] };

function coll() {
  return getDb().collection<FileDoc>("files");
}

function toDto(d: FileDoc): FsNodeDto {
  return {
    id: d._id,
    type: d.type,
    name: d.name,
    parent: d.parent,
    articleId: d.articleId,
    ext: d.ext,
    mime: d.mime,
    size: d.size,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    ...(d.secret === true ? { secret: true as const } : {}),
  };
}

@Injectable()
export class FilesService implements OnModuleInit {
  constructor(private readonly articles: ArticlesService) {}

  async onModuleInit() {
    // Best-effort: a down mongod must not block boot (same tolerance as the
    // articles legacy migration). Name dedup is query+insert, no unique index —
    // the same-parent race it would guard is acceptable for a personal instance.
    await coll()
      .createIndex({ parent: 1 })
      .catch((e) => console.warn("files 索引创建失败(忽略):", e?.message ?? e));
    // Catch-up sweep: downtime must not postpone expiry past the retention window.
    await this.sweepExpired().catch((e) => console.warn("files 回收站补扫失败(忽略):", e?.message ?? e));
  }

  /** parent 省略/空 = 桌面顶层。传了但不存在或不是文件夹 → 400。
   *  访客视角:自身/祖先私密的子树整棵不存在;doc 子项再按文章侧过滤
   *  (任一私密即隐藏 —— 桌面不留幽灵图标,doc 08 §1.1)。isOwner 默认 true:
   *  服务间直调(copy/move/nextUntitled)是主人语境,访客过滤只由 controller
   *  经 @Viewer 注入。 */
  async list(parent?: string, isOwner = true): Promise<FsNodeDto[]> {
    const pid = await this.resolveParent(parent, isOwner);
    const base = pid ? { parent: pid, deletedAt: null } : { parent: null, deletedAt: null };
    const docs = await guard(coll().find(isOwner ? base : { ...base, secret: { $ne: true } }).toArray());
    let dtos = docs.map(toDto).sort((a, b) => {
      const byType = typeOrder(a.type) - typeOrder(b.type);
      return byType !== 0 ? byType : a.name.localeCompare(b.name, "zh-CN");
    });
    if (!isOwner) {
      const docArticles = docs.filter((d) => d.type === "doc" && d.articleId).map((d) => d.articleId as string);
      if (docArticles.length) {
        const all = await this.articles.list(true);
        const secretIds = new Set(all.filter((a) => a.secret).map((a) => a.id));
        if (secretIds.size) dtos = dtos.filter((n) => !(n.type === "doc" && n.articleId && secretIds.has(n.articleId)));
      }
    }
    return dtos;
  }

  async get(id: string, isOwner = true): Promise<FsNodeDto> {
    const d = await this.find(id);
    if (!isOwner && (await nodeHiddenFromVisitors(d))) throw new NotFoundException(t("file.notFound", { id }));
    return toDto(d);
  }

  async create(req: CreateFsNodeRequest): Promise<FsNodeDto> {
    const parent = await this.resolveParent(req.parent);
    const now = new Date();
    if (req.type === "folder") {
      return toDto(
        await this.insert({
          _id: newId(),
          type: "folder",
          name: await this.freeName(t("file.newFolder"), parent),
          parent,
          articleId: null,
          ext: null,
          mime: null,
          size: null,
          createdAt: now,
          updatedAt: now,
          ...(req.secret ? { secret: true } : {}),
        }),
      );
    }
    if (req.type === "doc") {
      // Untitled numbering is global over articles (max N + 1), matching PAPER's
      // 未命名-N semantics; the article is created first, the node referencing it.
      const name = await this.nextUntitledName();
      const article = await this.articles.create(name, req.secret === true);
      try {
        return toDto(
          await this.insert({
            _id: newId(),
            type: "doc",
            name: article.name,
            parent,
            articleId: article.id,
            ext: null,
            mime: null,
            size: null,
            createdAt: now,
            updatedAt: now,
            ...(req.secret ? { secret: true } : {}),
          }),
        );
      } catch (e) {
        // Compensate: never leave an article no node points at (it would still be
        // visible and deletable in PAPER, but it's drift).
        await this.articles.remove(article.id).catch(() => {});
        throw e;
      }
    }
    // image: copy the bundled placeholder into .data/files/<id>.png
    const id = newId();
    const name = await this.freeName(t("file.newImage"), parent, ".png");
    await mkdir(FILES_DIR, { recursive: true });
    const dest = path.join(FILES_DIR, `${id}.png`);
    await copyFile(PLACEHOLDER, dest);
    const size = (await stat(dest)).size;
    try {
      return toDto(
        await this.insert({
          _id: id,
          type: "image",
          name,
          parent,
          articleId: null,
          ext: ".png",
          mime: "image/png",
          size,
          createdAt: now,
          updatedAt: now,
          ...(req.secret ? { secret: true } : {}),
        }),
      );
    } catch (e) {
      await unlink(dest).catch(() => {});
      throw e;
    }
  }

  /** 私密开关(doc 08 §1.1):只写自身意图,子树可见性由读侧祖先链判定,
   *  不做级联写 —— 级联会把子项自己的私密意图吞掉(文件夹 私→公 误放)。 */
  async setSecret(id: string, secret: boolean): Promise<FsNodeDto> {
    await this.findAlive(id);
    return toDto(await this.patch(id, { secret: secret ? true : null }));
  }

  /** Image bytes for the viewer endpoint; caller wraps in StreamableFile. */
  async readImage(id: string, isOwner = true): Promise<{ node: FsNodeDto; buf: Buffer }> {
    const d = await this.find(id);
    if (d.type !== "image") throw new NotFoundException(t("file.notImage", { id }));
    // 私密图片对访客 404 —— 连字节带存在性都不给(doc 08 §1.1)
    if (!isOwner && (await nodeHiddenFromVisitors(d))) throw new NotFoundException(t("file.notFound", { id }));
    const file = path.join(FILES_DIR, `${d._id}${d.ext ?? ".png"}`);
    try {
      return { node: toDto(d), buf: await readFile(file) };
    } catch (e) {
      // DB says image but the bytes are gone — surface 404 and leave a trail.
      console.warn(`files: 图片文件缺失 ${file}:`, e instanceof Error ? e.message : e);
      throw new NotFoundException(t("file.imageMissing", { id }));
    }
  }

  /** 重命名:用户输入的尾缀统一替换为本节点固有扩展名(doc→.md、image→原 ext),
   *  剥掉 ext 后主名为空 → 400。与存活兄弟撞名 → 400(桌面惯例:报错不静默改名,
   *  自动去重只留给 create/move/copy/restore 这些机器驱动的路径)。
   *  doc 节点先改文章再改节点,节点失败补偿回滚文章名。 */
  async rename(id: string, req: RenameFsNodeRequest): Promise<FsNodeDto> {
    const d = await this.findAlive(id);
    const raw = req.name.trim().slice(0, 100);
    if (!raw) throw new BadRequestException(t("file.nameEmpty"));
    const { ext } = splitName(d);
    const stem = ext && raw.endsWith(ext) ? raw.slice(0, -ext.length) : raw;
    if (!stem) throw new BadRequestException(t("file.badName"));
    const name = stem + ext;
    if (name !== d.name) {
      const clash = await guard(
        coll().findOne({ parent: d.parent, name, deletedAt: null, _id: { $ne: d._id } }, { projection: { _id: 1 } }),
      );
      if (clash) throw new BadRequestException(t("file.duplicate", { name }));
    }
    if (d.type === "doc" && d.articleId) {
      await this.articles.rename(d.articleId, name);
      try {
        return toDto(await this.patch(id, { name }));
      } catch (e) {
        await this.articles.rename(d.articleId, d.name).catch(() => {});
        throw e;
      }
    }
    return toDto(await this.patch(id, { name }));
  }

  /** 软删子树:同一 now 一次 updateMany,已删后代被 filter 跳过(保留其原时钟,
   *  不会被"先删子再删父"重置)。返回全部被删 id,前端据此关窗口。 */
  async trash(id: string): Promise<TrashResponse> {
    await this.findAlive(id);
    const now = new Date();
    const ids = await this.collectSubtree(id, { aliveOnly: true });
    await guard(coll().updateMany({ _id: { $in: ids }, deletedAt: null }, { $set: { deletedAt: now, updatedAt: now } }));
    return { trashed: ids };
  }

  /** 回收站列表只列"顶层"(parent 缺失或未被删);被删文件夹的内部条目不重复出现,
   *  随文件夹一起恢复/清除。原位置沿存活祖先链拼,遇缺失/已删即截断。 */
  async listTrash(): Promise<TrashItemDto[]> {
    const docs = await guard(coll().find({ deletedAt: { $ne: null } }).toArray());
    const trashedIds = new Set(docs.map((d) => d._id));
    const tops = docs.filter((d) => d.parent === null || !trashedIds.has(d.parent));
    const items: TrashItemDto[] = [];
    for (const d of tops) {
      items.push({
        ...toDto(d),
        deletedFromPath: await this.pathOf(d.parent),
        purgeAt: new Date((d.deletedAt as Date).getTime() + TRASH_RETAIN_MS).toISOString(),
      });
    }
    return items.sort((a, b) => {
      const byType = typeOrder(a.type) - typeOrder(b.type);
      return byType !== 0 ? byType : a.name.localeCompare(b.name, "zh-CN");
    });
  }

  /** 恢复:目标 = 原 parent(存活文件夹)否则桌面。只解除与 top 同批删除的后代
   *  (deletedAt 同一毫秒,一次 updateMany 写入)—— 先于文件夹独立删掉的条目留在
   *  回收站(parent 复活后它们自然重新成为顶层)。top 名冲突按 freeName 去重。 */
  async restore(id: string): Promise<FsNodeDto> {
    const d = await this.find(id);
    if (!d.deletedAt) throw new BadRequestException(t("file.notInTrash", { id }));
    let target: string | null = null;
    if (d.parent) {
      const p = await guard(coll().findOne({ _id: d.parent }, { projection: { type: 1, deletedAt: 1 } }));
      if (p && !p.deletedAt && p.type === "folder") target = d.parent;
    }
    const { stem, ext } = splitName(d);
    const name = await this.freeName(stem, target, ext);
    const cohort = await this.collectSubtree(id, { cohortOf: d.deletedAt });
    await guard(
      coll().updateMany({ _id: { $in: cohort }, deletedAt: d.deletedAt }, { $set: { deletedAt: null, updatedAt: new Date() } }),
    );
    return toDto(await this.patch(id, { parent: target, name }));
  }

  /** 彻底删除单个回收站条目:连带其内部所有已删条目(无论删除时钟)。 */
  async purge(id: string): Promise<{ purged: number }> {
    const d = await this.find(id);
    if (!d.deletedAt) throw new BadRequestException(t("file.notInTrash", { id }));
    const ids = await this.collectSubtree(id, { trashedOnly: true });
    return this.hardDelete(ids);
  }

  /** 清空回收站。 */
  async emptyTrash(): Promise<{ purged: number }> {
    const docs = await guard(coll().find({ deletedAt: { $ne: null } }, { projection: { _id: 1 } }).toArray());
    return this.hardDelete(docs.map((d) => d._id));
  }

  /** 深拷贝到目标(默认源位置):存活子树先快照再克隆 —— 拷进自身子树也只是
   *  这份快照的副本。doc 复制文章(get→create→save body),image 复制字节。 */
  async copy(id: string, req: FsParentRequest): Promise<FsNodeDto> {
    const src = await this.findAlive(id);
    const parent = req.parent !== undefined ? await this.resolveParent(req.parent) : src.parent;
    const tree = await this.snapshot(src);
    return toDto(await this.insertCopy(tree, parent));
  }

  /** 剪切粘贴 = 移动。同 parent 原样返回(不去重不触碰,否则会悄悄改名);
   *  目标在自身子树内 → 400(环会让 BFS/路径查询失去终止条件)。 */
  async move(id: string, req: FsParentRequest): Promise<FsNodeDto> {
    const d = await this.findAlive(id);
    const target = req.parent !== undefined ? await this.resolveParent(req.parent) : null;
    if (target === d.parent) return toDto(d);
    let pid: string | null = target;
    for (let depth = 0; pid && depth < 64; depth++) {
      if (pid === d._id) throw new BadRequestException(t("file.moveIntoSelf"));
      const p = await guard(coll().findOne({ _id: pid }, { projection: { parent: 1 } }));
      pid = p?.parent ?? null;
    }
    const { stem, ext } = splitName(d);
    const name = await this.freeName(stem, target, ext);
    return toDto(await this.patch(id, { parent: target, name }));
  }

  /** 到期清除:删除 deletedAt 早于保留期的条目;逐条 best-effort 清文章与字节,
   *  单条失败(文章已被书房删掉 / 字节缺失)不中断整批。 */
  async sweepExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - TRASH_RETAIN_MS);
    const docs = await guard(coll().find({ deletedAt: { $lt: cutoff } }, { projection: { _id: 1 } }).toArray());
    if (!docs.length) return;
    const { purged } = await this.hardDelete(docs.map((d) => d._id));
    console.log(`files: 回收站到期清除 ${purged} 项(保留 ${TRASH_DAYS} 天)`);
  }

  @Cron(process.env.FILES_TRASH_CRON ?? "23 4 * * *")
  private async sweepCron(): Promise<void> {
    await this.sweepExpired().catch((e) => console.warn("files 回收站定时清除失败(忽略):", e?.message ?? e));
  }

  private async insert(doc: FileDoc): Promise<FileDoc> {
    await guard(coll().insertOne(doc));
    return doc;
  }

  private async find(id: string): Promise<FileDoc> {
    if (!ID_RE.test(id)) throw new BadRequestException(t("file.badId", { id }));
    const d = await guard(coll().findOne({ _id: id }));
    if (!d) throw new NotFoundException(t("file.notFound", { id }));
    return d;
  }

  private async findAlive(id: string): Promise<FileDoc> {
    const d = await this.find(id);
    if (d.deletedAt) throw new BadRequestException(t("file.alreadyTrashed", { id }));
    return d;
  }

  private async patch(id: string, set: Partial<FileDoc>): Promise<FileDoc> {
    const d = await guard(
      coll().findOneAndUpdate({ _id: id }, { $set: { ...set, updatedAt: new Date() } }, { returnDocument: "after" }),
    );
    if (!d) throw new NotFoundException(t("file.notFound", { id }));
    return d;
  }

  /** BFS 收集子树(含 root)。三种口径:存活后代(软删用)/ 全部已删后代(彻底
   *  删除用)/ 与 root 同批删除的后代(恢复用 —— 独立更早删除的条目留在回收站)。
   *  10k 上限是环结构的保险(parent 理论上是树,move 的环检查之外不设防)。 */
  private async collectSubtree(
    root: string,
    mode: { aliveOnly: true } | { trashedOnly: true } | { cohortOf: Date },
  ): Promise<string[]> {
    const out = [root];
    for (let i = 0; i < out.length && out.length < 10_000; i++) {
      const children = await guard(coll().find({ parent: out[i] }, { projection: { deletedAt: 1 } }).toArray());
      for (const c of children) {
        const keep =
          "aliveOnly" in mode
            ? !c.deletedAt
            : "trashedOnly" in mode
              ? !!c.deletedAt
              : c.deletedAt != null && c.deletedAt.getTime() === mode.cohortOf.getTime();
        if (keep) out.push(c._id);
      }
    }
    return out;
  }

  private async pathOf(parent: string | null): Promise<string> {
    const parts: string[] = [];
    let pid = parent;
    for (let depth = 0; pid && depth < 32; depth++) {
      const p = await guard(coll().findOne({ _id: pid }, { projection: { name: 1, parent: 1, deletedAt: 1 } }));
      if (!p || p.deletedAt) break;
      parts.unshift(p.name);
      pid = p?.parent ?? null;
    }
    return ["桌面", ...parts].join("/");
  }

  /** 硬删 + 外部资源回收;逐条 best-effort,单条悬挂(文章已删/字节缺失)不拦整批。 */
  private async hardDelete(ids: string[]): Promise<{ purged: number }> {
    if (!ids.length) return { purged: 0 };
    const docs = await guard(coll().find({ _id: { $in: ids } }).toArray());
    for (const d of docs) {
      if (d.type === "doc" && d.articleId) await this.articles.remove(d.articleId).catch(() => {});
      if (d.type === "image") await unlink(path.join(FILES_DIR, `${d._id}${d.ext ?? ".png"}`)).catch(() => {});
    }
    await guard(coll().deleteMany({ _id: { $in: ids } }));
    return { purged: docs.length };
  }

  private async snapshot(d: FileDoc): Promise<TreeDoc> {
    const children = await guard(coll().find({ parent: d._id, deletedAt: null }).toArray());
    return { doc: d, children: await Promise.all(children.map((c) => this.snapshot(c))) };
  }

  private async insertCopy(t: TreeDoc, parent: string | null): Promise<FileDoc> {
    const d = t.doc;
    const now = new Date();
    const { stem, ext } = splitName(d);
    if (d.type === "doc" && d.articleId) {
      // 服务间直调不过控制器校验;body 最大 2MB,一次读入没有问题。
      const src = await this.articles.get(d.articleId);
      const name = await this.freeName(stem, parent, ext);
      const article = await this.articles.create(name);
      try {
        await this.articles.save(article.id, { body: src.body });
      } catch (e) {
        await this.articles.remove(article.id).catch(() => {});
        throw e;
      }
      return this.insert({
        _id: newId(),
        type: "doc",
        name,
        parent,
        articleId: article.id,
        ext: null,
        mime: null,
        size: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (d.type === "image") {
      const nid = newId();
      const name = await this.freeName(stem, parent, ext);
      await mkdir(FILES_DIR, { recursive: true });
      const dest = path.join(FILES_DIR, `${nid}${ext}`);
      await copyFile(path.join(FILES_DIR, `${d._id}${d.ext ?? ".png"}`), dest);
      const size = (await stat(dest)).size;
      try {
        return await this.insert({
          _id: nid,
          type: "image",
          name,
          parent,
          articleId: null,
          ext,
          mime: d.mime,
          size,
          createdAt: now,
          updatedAt: now,
        });
      } catch (e) {
        await unlink(dest).catch(() => {});
        throw e;
      }
    }
    const nid = newId();
    const node = await this.insert({
      _id: nid,
      type: "folder",
      name: await this.freeName(stem, parent),
      parent,
      articleId: null,
      ext: null,
      mime: null,
      size: null,
      createdAt: now,
      updatedAt: now,
    });
    for (const c of t.children) await this.insertCopy(c, nid);
    return node;
  }

  /** `""`/undefined → null(桌面顶层);otherwise must exist and be an ALIVE
   *  folder — 回收站里的文件夹不能当粘贴/新建目标。访客视角下私密文件夹
   *  视同不存在(同一句 400,不泄露它只是被藏了)。 */
  private async resolveParent(parent?: string, isOwner = true): Promise<string | null> {
    if (!parent) return null;
    if (!ID_RE.test(parent)) throw new BadRequestException(t("file.badParent", { parent }));
    if (!isOwner && (await hiddenFromVisitors(parent))) throw new BadRequestException(t("file.parentMissing", { parent }));
    const p = await guard(coll().findOne({ _id: parent, deletedAt: null }, { projection: { type: 1 } }));
    if (!p || p.type !== "folder") throw new BadRequestException(t("file.parentMissing", { parent }));
    return parent;
  }

  /** First free name among siblings: base+ext, base (2)+ext… Cap 999 guards the loop.
   *  Only alive siblings count — a trashed name frees up for reuse. */
  private async freeName(base: string, parent: string | null, ext = ""): Promise<string> {
    const taken = new Set(await guard(coll().distinct("name", { parent, deletedAt: null })));
    if (!taken.has(base + ext)) return base + ext;
    for (let n = 2; n <= 999; n++) {
      const cand = `${base} (${n})${ext}`;
      if (!taken.has(cand)) return cand;
    }
    return `${base} (${Date.now().toString(36)})${ext}`;
  }

  private async nextUntitledName(): Promise<string> {
    let max = 0;
    for (const a of await this.articles.list()) {
      const m = UNTITLED_RE.exec(a.name);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `${t("file.untitled")}-${max + 1}.md`;
  }
}

function typeOrder(t: FsType): number {
  return t === "folder" ? 0 : t === "doc" ? 1 : 2;
}

/** 主名/扩展名拆分:doc 固定 .md,image 固定其 ext,folder 无 ext。名字不带
 *  预期尾缀时整个名字视作主名(改名路径已保证尾缀,这里兜底脏数据)。 */
function splitName(d: FileDoc): { stem: string; ext: string } {
  const ext = d.type === "doc" ? ".md" : d.type === "image" ? (d.ext ?? ".png") : "";
  const stem = ext && d.name.endsWith(ext) && d.name.length > ext.length ? d.name.slice(0, -ext.length) : d.name;
  return { stem, ext };
}
