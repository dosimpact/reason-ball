import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';
import 'reflect-metadata';

import { AppModule } from './app.module';
import { createRemotesMiddleware } from './remotes.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/sec');
  app.enableCors({
    origin: true,
  });

  const expressApp = app.getHttpAdapter().getInstance() as Express;

  expressApp.use('/remotes/:name', createRemotesMiddleware());
  configureSwagger(app);

  const port = Number(process.env.PORT ?? 2801);
  await app.listen(port);
}

function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Reason Hwang SEC API')
    .setDescription('SEC EDGAR company and filing collection endpoints exposed through the BFF.')
    .setVersion('0.1.0')
    .addTag('SEC Collector')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs/sec', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}

void bootstrap();
