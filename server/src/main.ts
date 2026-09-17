import "./env";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 契约:全局 /v1 前缀 + 框架默认错误结构 + DTO 校验(docs/02 §3)
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(new ValidationPipe());
  // 前端 dev 在 :3030;生产部署后收紧到实际域名
  app.enableCors();
  // 让 onModuleDestroy 清理引擎定时器
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3031;
  await app.listen(port);
  console.log(`newboy-server listening on http://localhost:${port}`);
}

void bootstrap();
