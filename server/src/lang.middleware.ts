// Captures the request language (x-lang header, falling back to Accept-Language)
// into i18n's AsyncLocalStorage before guards/pipes/handlers run, so service
// exceptions translate at throw time.

import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { withLang, type Lang } from "./i18n";

@Injectable()
export class LangMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const raw = String(req.headers["x-lang"] ?? req.headers["accept-language"] ?? "zh");
    const lang: Lang = raw.toLowerCase().startsWith("en") ? "en" : "zh";
    withLang(lang, next);
  }
}
