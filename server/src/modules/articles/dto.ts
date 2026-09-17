// 稿纸文章契约:与前端 newboy/src/lib/api/types.ts 的 Article* 类型对齐。
// 存储是纯文本文件(id 由服务端生成,见 service),元数据只有 name/createdAt,
// updatedAt 直接取 .md 的 mtime —— 每次 PUT 重写文件,它天然就是最后保存时间。

import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export interface ArticleSummaryDto {
  id: string;
  /** 显示名(含 .md 后缀,书架图标标签直接用它) */
  name: string;
  /** 去空白字符数(中文语境的"字数"),与前端状态栏同一口径 */
  chars: number;
  /** ISO 创建时间(meta.json 记录,不依赖文件系统 birthtime —— 跨部署会漂) */
  createdAt: string;
  /** ISO 最后保存时间 */
  updatedAt: string;
  /** 私密标记(doc 08):访客视角下该文章不存在;缺省 = 公开。 */
  secret?: boolean;
}

export interface ArticleDto extends ArticleSummaryDto {
  /** markdown 源码全文 */
  body: string;
}

export class CreateArticleRequest {
  @IsString()
  @Length(1, 100)
  name!: string;

  /** 新建即私密(前端"默认私密"偏好透传);省略 = 公开。 */
  @IsOptional()
  @IsBoolean()
  secret?: boolean;
}

/** POST /articles/:id/secret 的开关体(动作端点先例:files 的 restore/purge)。 */
export class SecretRequest {
  @IsBoolean()
  secret!: boolean;
}

export class SaveArticleRequest {
  /** 上限 2MB:一篇 md 手写不到这个量,超了一定是客户端 bug */
  @IsString()
  @Length(0, 2_000_000)
  body!: string;

  /** 可选:顺带改名(改的是 meta,不动 md) */
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;
}
