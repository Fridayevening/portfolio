// 桌面文件系统节点契约:与前端 newboy/src/lib/api/types.ts 的 Fs* 类型对齐。
// 新建仍由服务端全权命名;rename 收用户名但冲突报错(桌面惯例),去重只发生在
// create/move/copy/restore 这些机器驱动的路径。

import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from "class-validator";
import { ID_RE } from "../db";

export type FsType = "folder" | "doc" | "image";

export interface FsNodeDto {
  id: string;
  type: FsType;
  /** 显示名:folder 新建文件夹 / doc 与 article 同名 / image 新建图片.png */
  name: string;
  /** 父文件夹 id;null = 桌面顶层 */
  parent: string | null;
  /** type=doc 时指向 articles._id,其余 null */
  articleId: string | null;
  /** type=image 时 ".png" */
  ext: string | null;
  /** type=image 时 "image/png" */
  mime: string | null;
  /** type=image 时字节数(拷贝后实测) */
  size: number | null;
  createdAt: string;
  updatedAt: string;
  /** 私密标记(doc 08):访客视角下该节点(及子树/关联文章)不存在;缺省 = 公开。 */
  secret?: boolean;
}

/** 回收站条目:节点 + 原位置路径(桌面/A/B)+ 到期清除时间。 */
export interface TrashItemDto extends FsNodeDto {
  deletedFromPath: string;
  purgeAt: string;
}

/** DELETE /files/:id 的返回:被软删的全部节点 id(前端据此关窗口)。 */
export interface TrashResponse {
  trashed: string[];
}

export class CreateFsNodeRequest {
  @IsIn(["folder", "doc", "image"])
  type!: FsType;

  @IsOptional()
  @Matches(ID_RE, { message: "Invalid parent id" })
  parent?: string;

  /** 新建即私密(前端"默认私密"偏好透传);省略 = 公开。 */
  @IsOptional()
  @IsBoolean()
  secret?: boolean;
}

/** POST /files/:id/secret 的开关体。 */
export class SecretRequest {
  @IsBoolean()
  secret!: boolean;
}

/** 粘贴目标(copy/move 共用):省略 = 桌面顶层(或 copy 默认源位置)。 */
export class FsParentRequest {
  @IsOptional()
  @Matches(ID_RE, { message: "Invalid parent id" })
  parent?: string;
}

export class RenameFsNodeRequest {
  @IsString()
  @Length(1, 100)
  name!: string;
}
