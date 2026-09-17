// 共享 MongoDB 入口:库 newboy,惰性 MongoClient 单例(操作时自动建连/重连,
// 连不上抛 503 不拖死其他模块)。id 用自生成 base36(时间戳+随机)而非
// ObjectId:沿用白名单语义,URL 友好。articles/files 共用,避免各模块
// 各持一份连接池和漂移的 503 文案。

import { ServiceUnavailableException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Db, MongoClient } from "mongodb";
import { t } from "../i18n";

/** id 白名单:服务端生成的 base36,客户端传入的 :id 必须匹配。 */
export const ID_RE = /^[a-z0-9]{6,64}$/;

export function newId(): string {
  return Date.now().toString(36) + randomBytes(3).toString("hex");
}

// Module-level singleton: the driver reconnects on its own after a mongod restart;
// 3 s selection timeout keeps a dead database from hanging requests for 30 s.
let client: MongoClient | null = null;
export function getDb(): Db {
  client ??= new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017", {
    serverSelectionTimeoutMS: 3000,
  });
  return client.db("newboy");
}

/** DB-level failures (mongod down etc.) → 503; the API shape stays intact. */
export function guard<T>(p: Promise<T>): Promise<T> {
  return p.catch((e) => {
    throw new ServiceUnavailableException(t("db.unavailable", { e: e?.message ?? e }));
  });
}
