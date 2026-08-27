import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config();

@Injectable()
export class AppConfigService {
  get appHost(): string {
    return process.env.APP_HOST ?? '0.0.0.0';
  }

  get appPort(): number {
    return this.readInt('APP_PORT', 3305);
  }

  get databaseUrl(): string {
    return (process.env.DATABASE_URL ?? '').trim();
  }

  get postgresHost(): string {
    return process.env.POSTGRES_HOST ?? 'localhost';
  }

  get postgresPort(): number {
    return this.readInt('POSTGRES_PORT', 5433);
  }

  get postgresUser(): string {
    return process.env.POSTGRES_USER ?? 'postgres';
  }

  get postgresPassword(): string {
    return process.env.POSTGRES_PASSWORD ?? 'postgres';
  }

  get postgresDb(): string {
    return process.env.POSTGRES_DB ?? 'sec_collector';
  }

  get secUserAgent(): string {
    return process.env.SEC_USER_AGENT ?? 'reason-hwang-bff/0.1 (your-email@example.com)';
  }

  get secRateLimitRps(): number {
    return this.readFloat('SEC_RATE_LIMIT_RPS', 4);
  }

  get secRetryCount(): number {
    return this.readInt('SEC_RETRY_COUNT', 3);
  }

  get secBulkSubmissionsUrl(): string {
    return (
      process.env.SEC_BULK_SUBMISSIONS_URL ??
      'https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip'
    );
  }

  get secBackfillRetentionYears(): number {
    return this.readInt('SEC_BACKFILL_RETENTION_YEARS', 20);
  }

  get secBackfillBatchSize(): number {
    return this.readInt('SEC_BACKFILL_BATCH_SIZE', 500);
  }

  get dataDir(): string {
    const configured = process.env.DATA_DIR ?? './data';
    return path.resolve(process.cwd(), configured);
  }

  get filingsDir(): string {
    return path.resolve(this.dataDir, 'filings');
  }

  get secBulkArchivePath(): string {
    return path.resolve(this.dataDir, 'sec-cache', 'submissions.zip');
  }

  private readInt(key: string, fallback: number): number {
    const value = process.env[key];
    if (!value) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private readFloat(key: string, fallback: number): number {
    const value = process.env[key];
    if (!value) {
      return fallback;
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
