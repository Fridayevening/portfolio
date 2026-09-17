import "./env";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Keep the public API contract under /v1 and validate every DTO.
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const origins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const express = app.getHttpAdapter().getInstance();
  // Render terminates public traffic at one trusted proxy hop.
  express.set("trust proxy", 1);
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app.enableCors({
    origin:
      origins.length > 0
        ? origins
        : process.env.NODE_ENV === "production"
          ? false
          : ["http://localhost:3030", "http://127.0.0.1:3030"],
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Accept", "Content-Type", "X-Lang", "X-Owner-Token"],
  });

  // Allow services to terminate child processes and timers cleanly.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3031;
  await app.listen(port, "0.0.0.0");
  console.log(`newboy-server listening on 0.0.0.0:${port}`);
}

void bootstrap();
