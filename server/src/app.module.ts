import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { LangMiddleware } from "./lang.middleware";
import { ArticlesModule } from "./modules/articles/articles.module";
import { AuthModule } from "./modules/auth/auth.module";
import { FilesModule } from "./modules/files/files.module";
import { HealthModule } from "./modules/health/health.module";
import { HotaruModule } from "./modules/hotaru/hotaru.module";
import { LabModule } from "./modules/lab/lab.module";
import { MarketModule } from "./modules/market/market.module";
import { NewsModule } from "./modules/news/news.module";
import { PreferencesModule } from "./modules/preferences/preferences.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HealthModule,
    MarketModule,
    HotaruModule,
    LabModule,
    NewsModule,
    PreferencesModule,
    ArticlesModule,
    FilesModule,
    AuthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LangMiddleware).forRoutes("*");
  }
}
