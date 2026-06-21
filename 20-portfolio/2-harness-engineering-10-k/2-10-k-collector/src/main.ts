import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { CompaniesSyncService } from './companies-sync/companies-sync.service';
import { AppConfigService } from './common/config/app.config';
import {
  FilingsCollectOptions,
  FilingsCollectorService,
} from './filings-collector/filings-collector.service';

const DEFAULT_LIMIT_COMPANIES = 100;
const DEFAULT_MAX_FILES = 500;
const REQUEST_ID_HEADER = 'x-request-id';

type RequestWithHeaders = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  url?: string;
};

type ResponseWithHeaders = {
  statusCode?: number;
  on(event: 'finish', listener: () => void): void;
  setHeader(name: string, value: string): void;
};

function getRequestPath(request: RequestWithHeaders): string {
  const rawPath = request.originalUrl ?? request.url ?? '/';
  return rawPath.split('?')[0] || '/';
}

function formatHttpRequestLog({
  durationMs,
  method,
  path,
  requestId,
  status,
}: {
  durationMs: number;
  method: string;
  path: string;
  requestId: string;
  status: number;
}): string {
  return JSON.stringify({
    event: 'collector_http_request',
    service: '10k-collector',
    requestId,
    method,
    path,
    status,
    durationMs,
  });
}

// Entry point:
// - no CLI command -> run HTTP API server
// - known CLI command -> run one-shot batch job and exit
async function bootstrap(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (!command) {
    await runHttpServer();
    return;
  }

  if (command === 'companies:sync' || command === 'filings:collect') {
    await runCliCommand(command, args);
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exitCode = 1;
}

async function runHttpServer(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  app.setGlobalPrefix('api');
  app.use(
    (
      request: RequestWithHeaders,
      response: ResponseWithHeaders,
      next: () => void,
    ) => {
      const startedAt = Date.now();
      const incoming = request.headers[REQUEST_ID_HEADER];
      const requestId =
        typeof incoming === 'string' && incoming.trim()
          ? incoming.trim()
          : randomUUID();

      request.headers[REQUEST_ID_HEADER] = requestId;
      response.setHeader(REQUEST_ID_HEADER, requestId);
      response.on('finish', () => {
        console.info(
          formatHttpRequestLog({
            durationMs: Date.now() - startedAt,
            method: request.method ?? 'UNKNOWN',
            path: getRequestPath(request),
            requestId,
            status: response.statusCode ?? 0,
          }),
        );
      });
      next();
    },
  );
  configureSwagger(app);

  const config = app.get(AppConfigService);
  await app.listen(config.appPort, config.appHost);

  console.log(`REST API listening on http://${config.appHost}:${config.appPort}/api`);
  console.log(`Swagger UI available at http://${config.appHost}:${config.appPort}/docs`);
  console.log('Available jobs:');
  console.log('  POST /api/company-sync-jobs');
  console.log('  POST /api/filing-sync-jobs  # body: { page, pageSize, since }');
  console.log('  POST /api/filing-download-jobs');
}

function configureSwagger(app: Awaited<ReturnType<typeof NestFactory.create>>): void {
  const config = new DocumentBuilder()
    .setTitle('SEC Filings Collector API')
    .setDescription(
      [
        'SEC EDGAR 기업/공시 메타데이터를 수집하고 원문 다운로드 작업을 관리하는 API입니다.',
        '모든 엔드포인트는 `/api` prefix 아래에 노출됩니다.',
      ].join(' '),
    )
    .setVersion('0.1.0')
    .addTag('SEC Collector', '회사 동기화, filing 수집, 다운로드, 재시도 API')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}

async function runCliCommand(command: string, args: string[]): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    if (command === 'companies:sync') {
      const service = app.get(CompaniesSyncService);
      const summary = await service.syncCompanies();
      console.log(`[companies:sync] synced=${summary.syncedCount}`);
      return;
    }

    const options = parseFilingsOptions(args);
    const service = app.get(FilingsCollectorService);
    const summary = await service.collectAndDownload(options);

    console.log(
      `[filings:collect] companies=${summary.companiesProcessed} synced=${summary.filingsSynced} downloaded=${summary.downloaded} failed=${summary.failed}`,
    );
  } finally {
    await app.close();
  }
}

function parseFilingsOptions(args: string[]): FilingsCollectOptions {
  let limitCompanies = DEFAULT_LIMIT_COMPANIES;
  let maxFiles = DEFAULT_MAX_FILES;
  let since: string | undefined;
  const ciks: string[] = [];
  const tickers: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--') {
      continue;
    }

    if (arg === '--limit-companies') {
      limitCompanies = parsePositiveInt(args[i + 1], '--limit-companies');
      i += 1;
      continue;
    }

    if (arg === '--max-files') {
      maxFiles = parsePositiveInt(args[i + 1], '--max-files');
      i += 1;
      continue;
    }

    if (arg === '--cik' || arg === '--ciks') {
      ciks.push(...parseListOption(args[i + 1], arg));
      i += 1;
      continue;
    }

    if (arg === '--ticker' || arg === '--tickers') {
      tickers.push(...parseListOption(args[i + 1], arg));
      i += 1;
      continue;
    }

    if (arg === '--since') {
      since = args[i + 1];
      if (!since) {
        throw new Error('--since requires YYYY-MM-DD value');
      }
      i += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    limitCompanies,
    maxFiles,
    since,
    ciks: deduplicate(ciks),
    tickers: deduplicate(tickers.map((ticker) => ticker.toUpperCase())),
  };
}

function parsePositiveInt(raw: string | undefined, optionName: string): number {
  if (!raw) {
    throw new Error(`${optionName} requires a numeric value`);
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer`);
  }

  return parsed;
}

function parseListOption(raw: string | undefined, optionName: string): string[] {
  if (!raw) {
    throw new Error(`${optionName} requires a comma-separated value`);
  }

  const values = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (values.length === 0) {
    throw new Error(`${optionName} requires at least one non-empty value`);
  }

  return values;
}

function deduplicate(values: string[]): string[] | undefined {
  const unique = Array.from(new Set(values));
  return unique.length > 0 ? unique : undefined;
}

function printUsage(): void {
  console.log('Usage:');
  console.log('  pnpm run start      # run REST API server');
  console.log('  pnpm run companies:sync');
  console.log('  pnpm run filings:collect -- --limit-companies 100 --since 2023-01-01 --max-files 500');
  console.log('  pnpm run filings:collect -- --tickers AAPL,MSFT --since 2025-01-01 --max-files 20');
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
