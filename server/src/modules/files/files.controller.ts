// 桌面文件系统端点:GET 列表(?parent= 省略=桌面顶层)/单查/图片字节/回收站,
// POST 新建与粘贴动作,PUT 改名,DELETE 进回收站/清空。
// 图片是 <img> 查看语义:inline 下发;URL 天然被不可变节点 id 版本化(本期不
// 替换字节),immutable + 1y 让文件夹窗口反复开关零流量。
// 访客只读且过滤私密子树;一切变更(含回收站与私密开关)主人专属(doc 08)。

import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { FilesService } from "./files.service";
import { OwnerGuard, OwnerOnly, Viewer } from "../auth/owner.guard";
import {
  CreateFsNodeRequest,
  FsParentRequest,
  RenameFsNodeRequest,
  SecretRequest,
  type FsNodeDto,
  type TrashItemDto,
  type TrashResponse,
} from "./dto";

@Controller("files")
@UseGuards(OwnerGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get()
  list(@Viewer() isOwner: boolean, @Query("parent") parent?: string): Promise<FsNodeDto[]> {
    return this.files.list(parent, isOwner);
  }

  // 字面量 trash 路由必须声明在 :id 之前:本应用未启用 Nest 12 的 specificity
  // 排序,按声明序匹配,后声明的话 "trash" 会被 :id 吃掉。
  @Get("trash")
  @OwnerOnly()
  trash(): Promise<TrashItemDto[]> {
    return this.files.listTrash();
  }

  @Delete("trash")
  @OwnerOnly()
  emptyTrash(): Promise<{ purged: number }> {
    return this.files.emptyTrash();
  }

  @Get(":id")
  get(@Viewer() isOwner: boolean, @Param("id") id: string): Promise<FsNodeDto> {
    return this.files.get(id, isOwner);
  }

  @Post()
  @OwnerOnly()
  create(@Body() req: CreateFsNodeRequest): Promise<FsNodeDto> {
    return this.files.create(req);
  }

  @Get(":id/image")
  @Header("Cache-Control", "public, max-age=31536000, immutable")
  async image(@Viewer() isOwner: boolean, @Param("id") id: string): Promise<StreamableFile> {
    const { node, buf } = await this.files.readImage(id, isOwner);
    return new StreamableFile(buf, {
      type: node.mime ?? "image/png",
      // filename* (RFC 5987) carries the Chinese display name; plain filename
      // stays ASCII-safe for ancient clients.
      disposition: `inline; filename="image-${node.id}.png"; filename*=UTF-8''${encodeURIComponent(node.name)}`,
      length: buf.length,
    });
  }

  @Put(":id")
  @OwnerOnly()
  rename(@Param("id") id: string, @Body() req: RenameFsNodeRequest): Promise<FsNodeDto> {
    return this.files.rename(id, req);
  }

  @Delete(":id")
  @OwnerOnly()
  trashOne(@Param("id") id: string): Promise<TrashResponse> {
    return this.files.trash(id);
  }

  @Post(":id/restore")
  @OwnerOnly()
  restore(@Param("id") id: string): Promise<FsNodeDto> {
    return this.files.restore(id);
  }

  @Post(":id/purge")
  @OwnerOnly()
  purge(@Param("id") id: string): Promise<{ purged: number }> {
    return this.files.purge(id);
  }

  @Post(":id/copy")
  @OwnerOnly()
  copy(@Param("id") id: string, @Body() req: FsParentRequest): Promise<FsNodeDto> {
    return this.files.copy(id, req);
  }

  @Post(":id/move")
  @OwnerOnly()
  move(@Param("id") id: string, @Body() req: FsParentRequest): Promise<FsNodeDto> {
    return this.files.move(id, req);
  }

  @Post(":id/secret")
  @OwnerOnly()
  secret(@Param("id") id: string, @Body() req: SecretRequest): Promise<FsNodeDto> {
    return this.files.setSecret(id, req.secret);
  }
}
