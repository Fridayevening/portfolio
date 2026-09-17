// 稿纸文章的 MongoDB 存储:库 newboy,集合 articles,文档
// {_id: 自生成 base36 id, name, body, chars, createdAt, updatedAt}。
// 连接与 id 工具见 ../db(与 files 模块共享);启动时自动迁移旧文件系统
// 数据(.data/articles/ → mongo),迁完目录改名留档。

import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { readdir, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { ID_RE, getDb, guard, newId } from "../db";
import { t } from "../../i18n";
import { articleHiddenByFs, hiddenArticleIds } from "../visibility";
import type { ArticleDto, ArticleSummaryDto, SaveArticleRequest } from "./dto";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const LEGACY_DIR = path.join(ROOT, ".data", "articles");

/** 与前端状态栏同一口径:去空白字符数。 */
function countChars(s: string): number {
  return s.replace(/\s/g, "").length;
}

type ArticleDoc = {
  _id: string;
  name: string;
  body: string;
  chars: number;
  createdAt: Date;
  updatedAt: Date;
  /** 私密标记(doc 08):true = 访客不可见;null/缺省 = 公开。 */
  secret?: boolean | null;
};

function coll() {
  return getDb().collection<ArticleDoc>("articles");
}

function toSummary(d: ArticleDoc): ArticleSummaryDto {
  return {
    id: d._id,
    name: d.name,
    chars: d.chars,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    ...(d.secret === true ? { secret: true as const } : {}),
  };
}

function toDto(d: ArticleDoc): ArticleDto {
  return { ...toSummary(d), body: d.body };
}

@Injectable()
export class ArticlesService implements OnModuleInit {
  async onModuleInit() {
    await this.migrateLegacyFiles().catch((e) =>
      console.warn("articles 旧数据迁移失败(忽略,继续用 mongo):", e?.message ?? e),
    );
  }

  // One-shot import of the filesystem era: .data/articles/<id>.md(+.meta.json) →
  // mongo docs. Idempotent (duplicate _id skipped), and the directory is renamed
  // (never deleted) so a bad migration is recoverable by hand.
  private async migrateLegacyFiles() {
    let entries: string[];
    try {
      entries = await readdir(LEGACY_DIR);
    } catch {
      return; // no legacy directory = nothing to do
    }
    const ids = entries
      .filter((n) => n.endsWith(".md"))
      .map((n) => n.slice(0, -3))
      .filter((id) => ID_RE.test(id));

    const docs: ArticleDoc[] = [];
    for (const id of ids) {
      const md = path.join(LEGACY_DIR, `${id}.md`);
      const body = await readFile(md, "utf8");
      let name = `${id}.md`;
      let createdAt = new Date();
      try {
        const meta = JSON.parse(await readFile(path.join(LEGACY_DIR, `${id}.meta.json`), "utf8"));
        if (typeof meta?.name === "string" && meta.name) name = meta.name;
        if (typeof meta?.createdAt === "string") createdAt = new Date(meta.createdAt);
      } catch {
        // meta missing/corrupt: fallbacks above stand
      }
      docs.push({ _id: id, name, body, chars: countChars(body), createdAt, updatedAt: (await stat(md)).mtime });
    }
    if (docs.length) {
      await coll()
        .insertMany(docs, { ordered: false })
        .catch((e) => {
          // E11000 duplicates = already migrated; anything else is real
          if (!/duplicate/i.test(String(e?.message ?? e))) throw e;
        });
    }
    await rename(LEGACY_DIR, `${LEGACY_DIR}.migrated-${Date.now()}`);
    console.log(`articles: 已从文件系统迁移 ${docs.length} 篇到 MongoDB`);
  }

  /** isOwner 默认 true:服务间直调(files 拷贝/命名)是主人语境;访客过滤
   *  只由 controller 经 @Viewer 注入。访客额外剔除 fs 侧被隐藏的 doc 节点
   *  挂着的文章(私密文件夹里的文稿不能只靠桌面藏,书架/直连 GET 同样不给)。 */
  async list(isOwner = true): Promise<ArticleSummaryDto[]> {
    const query = isOwner ? {} : { secret: { $ne: true } };
    let docs = await guard(
      coll().find(query, { projection: { body: 0 } }).sort({ updatedAt: -1 }).toArray(),
    );
    if (!isOwner && docs.length) {
      const hidden = await hiddenArticleIds();
      if (hidden.size) docs = docs.filter((d) => !hidden.has(d._id));
    }
    return docs.map(toSummary);
  }

  async get(id: string, isOwner = true): Promise<ArticleDto> {
    this.checkId(id);
    const d = await guard(coll().findOne({ _id: id }));
    if (!d) throw new NotFoundException(t("article.notFound", { id }));
    if (!isOwner && (d.secret === true || (await articleHiddenByFs(id)))) {
      // 404 而非 403:不向访客承认资源存在(doc 08 §1.1)
      throw new NotFoundException(t("article.notFound", { id }));
    }
    return toDto(d);
  }

  async create(name: string, secret = false): Promise<ArticleDto> {
    const now = new Date();
    const doc: ArticleDoc = {
      _id: newId(),
      name,
      body: "",
      chars: 0,
      createdAt: now,
      updatedAt: now,
      ...(secret ? { secret: true } : {}),
    };
    await guard(coll().insertOne(doc));
    return toDto(doc);
  }

  /** 私密开关(doc 08 §1.1):全量保存(PUT)不触碰此字段,自动保存永不改隐私。 */
  async setSecret(id: string, secret: boolean): Promise<ArticleDto> {
    this.checkId(id);
    const d = await guard(
      coll().findOneAndUpdate(
        { _id: id },
        { $set: { secret: secret ? true : null, updatedAt: new Date() } },
        { returnDocument: "after" },
      ),
    );
    if (!d) throw new NotFoundException(t("article.notFound", { id }));
    return toDto(d);
  }

  async save(id: string, req: SaveArticleRequest): Promise<ArticleDto> {
    this.checkId(id);
    const d = await guard(
      coll().findOneAndUpdate(
        { _id: id },
        {
          $set: {
            body: req.body,
            chars: countChars(req.body),
            updatedAt: new Date(),
            ...(req.name !== undefined ? { name: req.name } : {}),
          },
        },
        { returnDocument: "after" },
      ),
    );
    if (!d) throw new NotFoundException(t("article.notFound", { id }));
    return toDto(d);
  }

  /** 只改名的窄路径:files 模块改名 doc 节点时同步文章名用,免整 body 回写。 */
  async rename(id: string, name: string): Promise<void> {
    this.checkId(id);
    const d = await guard(coll().findOneAndUpdate({ _id: id }, { $set: { name, updatedAt: new Date() } }));
    if (!d) throw new NotFoundException(t("article.notFound", { id }));
  }

  async remove(id: string): Promise<void> {
    this.checkId(id);
    const r = await guard(coll().deleteOne({ _id: id }));
    if (r.deletedCount === 0) throw new NotFoundException(t("article.notFound", { id }));
  }

  private checkId(id: string): void {
    if (!ID_RE.test(id)) throw new BadRequestException(t("article.badId", { id }));
  }
}
