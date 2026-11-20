import 'dotenv/config';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApp, API_PREFIX } from './app.factory';

async function bootstrap() {
  const { app } = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`BARit API on http://localhost:${port}/${API_PREFIX}`, 'Bootstrap');
}

void bootstrap();
