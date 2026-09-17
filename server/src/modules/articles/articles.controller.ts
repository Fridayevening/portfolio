// 稿纸文章端点:GET 列表/全文(访客视角过滤),POST 新建,PUT 全量保存
// (name 可选=顺带改名),DELETE 删除,POST :id/secret 私密开关。
// PUT 幂等,就是为前端"编辑 2 秒防抖自动保存 + Ctrl+S 立即保存"的双轨设计的。
// 写端点全部主人专属(doc 08);读端点带身份过滤,@Viewer 递进 service。

import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ArticlesService } from "./articles.service";
import { OwnerGuard, OwnerOnly, Viewer } from "../auth/owner.guard";
import { CreateArticleRequest, SaveArticleRequest, SecretRequest, type ArticleDto, type ArticleSummaryDto } from "./dto";

@Controller("articles")
@UseGuards(OwnerGuard)
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  list(@Viewer() isOwner: boolean): Promise<ArticleSummaryDto[]> {
    return this.articles.list(isOwner);
  }

  @Get(":id")
  get(@Viewer() isOwner: boolean, @Param("id") id: string): Promise<ArticleDto> {
    return this.articles.get(id, isOwner);
  }

  @Post()
  @OwnerOnly()
  create(@Body() req: CreateArticleRequest): Promise<ArticleDto> {
    return this.articles.create(req.name, req.secret === true);
  }

  @Put(":id")
  @OwnerOnly()
  save(@Param("id") id: string, @Body() req: SaveArticleRequest): Promise<ArticleDto> {
    return this.articles.save(id, req);
  }

  @Post(":id/secret")
  @OwnerOnly()
  secret(@Param("id") id: string, @Body() req: SecretRequest): Promise<ArticleDto> {
    return this.articles.setSecret(id, req.secret);
  }

  @Delete(":id")
  @OwnerOnly()
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.articles.remove(id);
    return { ok: true };
  }
}
