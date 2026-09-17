// 报纸卡数据端点:GET /v1/news/today 读缓存(空缓存时服务内同步补抓一轮);
// POST /v1/news/refresh 手动重抓 + AI 重编(不等 cron,排障/换版用)。

import { Controller, Get, Post } from "@nestjs/common";
import { NewsService } from "./news.service";
import type { NewsTodayResponse } from "./dto";

@Controller("news")
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get("today")
  today(): Promise<NewsTodayResponse> {
    return this.news.getToday();
  }

  @Post("refresh")
  async refresh(): Promise<NewsTodayResponse> {
    await this.news.refresh();
    return this.news.getToday();
  }
}
