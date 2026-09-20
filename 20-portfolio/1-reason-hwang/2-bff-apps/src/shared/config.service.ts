import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'node:path';


dotenv.config();

@Injectable()
export class AppConfigService {
  private readonly settings = readEnvironment(process.env);

  get appEnv() { return this.settings.appEnv; }
  get logDir() { return this.settings.logDir; }
  get logLevel() { return this.settings.logLevel; }
  get appHost() { return this.settings.appHost; }
  get appPort() { return this.settings.appPort; }
  get databaseUrl() { return this.settings.databaseUrl; }
  get postgresHost() { return this.settings.postgresHost; }
  get postgresPort() { return this.settings.postgresPort; }
  get postgresUser() { return this.settings.postgresUser; }
  get postgresPassword() { return this.settings.postgresPassword; }
  get postgresDb() { return this.settings.postgresDb; }
  get secUserAgent() { return this.settings.secUserAgent; }
  get secRateLimitRps() { return this.settings.secRateLimitRps; }
  get secRetryCount() { return this.settings.secRetryCount; }
  get secDocumentMaxBytes() { return this.settings.secDocumentMaxBytes; }
  get secBulkSubmissionsUrl() { return this.settings.secBulkSubmissionsUrl; }
  get secBackfillBatchSize() { return this.settings.secBackfillBatchSize; }
  get dataDir() { return this.settings.dataDir; }
  get secBulkArchivePath() { return this.settings.secBulkArchivePath; }
  get swaggerEnabled() { return this.settings.swaggerEnabled; }
}

export function readEnvironment(env: NodeJS.ProcessEnv, cwd = process.cwd()) {
  const integer = (key: string, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER) => {
    const raw = env[key];
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`${key} must be an integer between ${min} and ${max}.`);
    }
    return value;
  };
  const positiveNumber = (key: string, fallback: number) => {
    const raw = env[key];
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value) || value <= 0) {
      throw new Error(`${key} must be a positive number.`);
    }
    return value;
  };
  const url = (key: string, fallback: string, protocols: string[], optional = false) => {
    const value = (env[key] ?? fallback).trim();
    if (optional && !value) return '';
    try {
      const parsed = new URL(value);
      if (!protocols.includes(parsed.protocol) || !parsed.hostname) throw new Error();
    } catch {
      // Never include credentials or the supplied URL in configuration errors.
      throw new Error(`${key} must be a valid ${protocols.join('/')} URL.`);
    }
    return value;
  };
  const swagger = env.SWAGGER_ENABLED ?? 'true';
  if (!['true', 'false'].includes(swagger)) throw new Error('SWAGGER_ENABLED must be true or false.');
  const dataDir = path.resolve(cwd, env.DATA_DIR ?? './data');
  const rawEnv = env.APP_ENV ?? env.NODE_ENV ?? 'local';
  const environments: Record<string, 'local' | 'stage' | 'prod'> = {
    local: 'local', development: 'local', test: 'local', stage: 'stage', staging: 'stage', prod: 'prod', production: 'prod',
  };
  const appEnv = environments[rawEnv];
  if (!appEnv) throw new Error('APP_ENV must be local, stage or prod.');
  const logLevel = env.LOG_LEVEL ?? (appEnv === 'local' ? 'debug' : 'info');
  if (!['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'].includes(logLevel)) throw new Error('Invalid LOG_LEVEL.');
  return Object.freeze({
    appEnv, logLevel,
    logDir: path.resolve(cwd, env.LOG_DIR ?? './data/logs'),
    appHost: env.APP_HOST ?? '0.0.0.0',
    appPort: env.PORT !== undefined ? integer('PORT', 2801, 0, 65535) : integer('APP_PORT', 2801, 0, 65535),
    databaseUrl: url('DATABASE_URL', '', ['postgres:', 'postgresql:'], true),
    postgresHost: env.POSTGRES_HOST ?? 'localhost',
    postgresPort: integer('POSTGRES_PORT', 5433, 1, 65535),
    postgresUser: env.POSTGRES_USER ?? 'postgres',
    postgresPassword: env.POSTGRES_PASSWORD ?? 'postgres',
    postgresDb: env.POSTGRES_DB ?? 'sec_collector',
    secUserAgent: env.SEC_USER_AGENT ?? 'reason-hwang-bff/0.1 (your-email@example.com)',
    secRateLimitRps: positiveNumber('SEC_RATE_LIMIT_RPS', 4),
    secRetryCount: integer('SEC_RETRY_COUNT', 3, 0),
    secDocumentMaxBytes: integer('SEC_DOCUMENT_MAX_BYTES', 32 * 1024 * 1024, 1),
    secBulkSubmissionsUrl: url('SEC_BULK_SUBMISSIONS_URL', 'https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip', ['http:', 'https:']),
    secBackfillBatchSize: integer('SEC_BACKFILL_BATCH_SIZE', 500, 1),
    dataDir,
    secBulkArchivePath: path.resolve(dataDir, 'sec-cache', 'submissions.zip'),
    swaggerEnabled: swagger === 'true',
  });
}

export const appConfig = new AppConfigService();
