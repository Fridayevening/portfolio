import { Module } from "@nestjs/common";
import { ArticlesModule } from "../articles/articles.module";
import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";

@Module({
  imports: [ArticlesModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
