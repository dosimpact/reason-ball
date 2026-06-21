import { NestFactory } from '@nestjs/core';
import type { Express } from 'express';
import 'reflect-metadata';

import { AppModule } from './app.module';
import { createRemotesMiddleware } from './remotes.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
  });

  const expressApp = app.getHttpAdapter().getInstance() as Express;

  expressApp.use('/remotes/:name', createRemotesMiddleware());

  const port = Number(process.env.PORT ?? 2801);
  await app.listen(port);
}

void bootstrap();
