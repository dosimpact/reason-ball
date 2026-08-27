import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';
import 'reflect-metadata';

import { AppModule } from './app.module';
import { createRemotesMiddleware } from './remotes.middleware';

const SWAGGER_UI_PATH = 'docs/sec';
const SWAGGER_JSON_PATH = 'docs/sec/openapi.json';
const SWAGGER_YAML_PATH = 'docs/sec/openapi.yaml';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/sec');
  app.enableCors({
    origin: true,
  });

  const expressApp = app.getHttpAdapter().getInstance() as Express;

  expressApp.use('/remotes/:name', createRemotesMiddleware());
  if (process.env.SWAGGER_ENABLED !== 'false') {
    configureSwagger(app);
  }

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

  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      operationIdFactory: (_controllerKey, methodKey) => methodKey,
    });

  SwaggerModule.setup(SWAGGER_UI_PATH, app, documentFactory, {
    customSiteTitle: 'Reason Hwang SEC API Docs',
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    yamlDocumentUrl: SWAGGER_YAML_PATH,
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}

void bootstrap();
