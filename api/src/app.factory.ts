import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { LOCAL_UPLOAD_DIR } from './admin/uploads.controller';

export const API_PREFIX = 'api/v1';

/** Express-level middleware that sits in front of Nest. */
export function createServer(): express.Express {
  const server = express();
  server.disable('x-powered-by');
  if ((process.env.STORAGE_DRIVER ?? 'local') === 'local') {
    server.use('/uploads', express.static(LOCAL_UPLOAD_DIR, { maxAge: '1h', fallthrough: false }));
  }
  return server;
}

/** Prefix, CORS and validation — shared by every entry point and the e2e tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: [process.env.GUEST_URL, process.env.ADMIN_URL].filter((o): o is string => !!o),
    credentials: false,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  return app;
}

/** Bootstrap for the local server (main.ts) and the Cloud Function (function.ts). */
export async function createApp(): Promise<{ app: INestApplication; server: express.Express }> {
  const server = createServer();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['log', 'warn', 'error'],
  });
  configureApp(app);
  await app.init();
  return { app, server };
}
