import 'reflect-metadata';
import { config } from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

// Load .env before anything reads process.env at import time
config();

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'OPENWA_URL', 'OPENWA_API_KEY', 'WEBHOOK_SECRET', 'PUBLIC_URL'];

async function bootstrap() {
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')} (see backend/.env.example)`);
    process.exit(1);
  }

  const { AppModule } = await import('./app.module');
  const { json, urlencoded } = await import('express');
  // rawBody: true keeps the exact request bytes, needed to verify OpenWA's HMAC webhook signature.
  const app = await NestFactory.create(AppModule, { rawBody: true, bodyParser: false });
  app.use(json({ limit: '25mb', verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf; } }));
  app.use(urlencoded({ limit: '25mb', extended: true }));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.FRONTEND_URL).split(','), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.PORT);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api`);
}
bootstrap();
