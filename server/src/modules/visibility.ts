// 访客视角的读侧可见性(doc 08 §1.1):节点 secret、任一祖先 secret、doc 节点
// 挂的文章 secret —— 任一命中即"对访客不存在"(404/从列表剔除,不给存在性)。
// 收敛在这一个文件:articles 与 files 两侧都要判定,避免两份漂移的实现。
// 直查两个集合而非互注 Service —— files→articles 已有服务间依赖,反向注入
// 成环。判定不筛 deletedAt:私密文件夹进了回收站,里面的东西不能因此对访客
// 复活(彻底清除时文章随 hardDelete 一并删除,不会悬挂)。

import { ID_RE, getDb, guard } from "./db";

type VisFileNode = {
  _id: string;
  type?: string;
  parent: string | null;
  articleId?: string | null;
  secret?: boolean | null;
};

// 深度上限 64 与 files.move 的环检查同源:parent 理论上是树,上限是环结构保险。
const MAX_DEPTH = 64;

/** 只查祖先链(调用方已自查节点自身)。链断(祖先被硬删)按现存链判定。 */
export async function ancestorsHide(parent: string | null): Promise<boolean> {
  let pid = parent;
  for (let depth = 0; pid && depth < MAX_DEPTH; depth++) {
    const n = await guard(
      getDb().collection<VisFileNode>("files").findOne({ _id: pid }, { projection: { parent: 1, secret: 1 } }),
    );
    if (!n) return false;
    if (n.secret === true) return true;
    pid = n.parent;
  }
  return false;
}

/** 节点自身或祖先任一 secret → 隐藏。 */
export async function hiddenFromVisitors(id: string): Promise<boolean> {
  if (!ID_RE.test(id)) return false;
  const n = await guard(
    getDb().collection<VisFileNode>("files").findOne({ _id: id }, { projection: { parent: 1, secret: 1 } }),
  );
  if (!n) return false;
  return n.secret === true || (await ancestorsHide(n.parent));
}

/** fs 节点的完整访客判定(含文章联动:任一私密即隐藏,桌面不留幽灵图标)。 */
export async function nodeHiddenFromVisitors(node: VisFileNode): Promise<boolean> {
  if (node.secret === true) return true;
  if (await ancestorsHide(node.parent)) return true;
  if (node.type === "doc" && node.articleId) return articleSecret(node.articleId);
  return false;
}

async function articleSecret(articleId: string): Promise<boolean> {
  const a = await guard(
    getDb().collection<{ _id: string; secret?: boolean | null }>("articles").findOne(
      { _id: articleId },
      { projection: { secret: 1 } },
    ),
  );
  return a?.secret === true;
}

/** 文章是否有任一被隐藏的 doc 节点(文章.secret 之外的另一条隐藏通路)。 */
export async function articleHiddenByFs(articleId: string): Promise<boolean> {
  if (!ID_RE.test(articleId)) return false;
  const nodes = await guard(
    getDb()
      .collection<VisFileNode>("files")
      .find({ articleId, type: "doc" }, { projection: { parent: 1, secret: 1 } })
      .limit(20)
      .toArray(),
  );
  for (const n of nodes) {
    if (n.secret === true || (await ancestorsHide(n.parent))) return true;
  }
  return false;
}

/** 访客不可见的文章 id 集(articles.list 用):一次全量读入,内存里沿祖先链
 *  判定 —— 个人站规模(几十~几百节点)一次 find 的成本可以忽略。 */
export async function hiddenArticleIds(): Promise<Set<string>> {
  const all = await guard(
    getDb()
      .collection<VisFileNode>("files")
      .find({}, { projection: { type: 1, parent: 1, articleId: 1, secret: 1 } })
      .toArray(),
  );
  const byId = new Map(all.map((n) => [n._id, n]));
  const hidden = new Set<string>();
  for (const n of all) {
    if (n.type !== "doc" || !n.articleId) continue;
    let cur: VisFileNode | undefined = n;
    for (let depth = 0; cur && depth < MAX_DEPTH; depth++) {
      if (cur.secret === true) {
        hidden.add(n.articleId);
        break;
      }
      cur = cur.parent ? byId.get(cur.parent) : undefined;
    }
  }
  return hidden;
}
