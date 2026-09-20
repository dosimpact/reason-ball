import { Inject, Injectable, Logger } from '@nestjs/common';
import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AppConfigService } from '../../shared/config.service';
import { documentFromBytes } from './sec.utils';

class HttpStatusError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SecClientService {
  private readonly logger = new Logger(SecClientService.name);
  private lastRequestAt = 0;
  private userAgentWarningShown = false;
  private throttleQueue: Promise<void> = Promise.resolve();

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) { }

  async getJson<T>(url: string): Promise<T> {
    const response = await this.request(url);
    return (await response.json()) as T;
  }

  async downloadDocument(url: string) {
    const response = await this.request(url);
    if (!response.body) throw new Error('SEC_DOCUMENT_EMPTY');
    const limit = this.config.secDocumentMaxBytes;
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      if (Number(response.headers.get('content-length')) > limit) {
        throw new Error('SEC_DOCUMENT_TOO_LARGE');
      }
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) throw new Error('SEC_DOCUMENT_TOO_LARGE');
        chunks.push(Buffer.from(value));
      }
      return documentFromBytes(Buffer.concat(chunks, size), response.headers.get('content-type'));
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  async downloadFile(
    url: string,
    destinationPath: string,
    onProgress?: (downloadedBytes: number, totalBytes: number | null) => void,
  ): Promise<void> {
    const response = await this.request(url, 60 * 60 * 1000);
    if (!response.body) {
      throw new Error(`SEC response has no body: ${url}`);
    }

    const temporaryPath = `${destinationPath}.part`;
    const totalHeader = response.headers.get('content-length');
    const totalBytes = totalHeader ? Number.parseInt(totalHeader, 10) : null;
    let downloadedBytes = 0;
    const source = Readable.fromWeb(response.body as never);
    source.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length;
      try { onProgress?.(downloadedBytes, totalBytes); }
      catch (error) { source.destroy(error instanceof Error ? error : new Error(String(error))); }
    });

    try {
      await pipeline(source, createWriteStream(temporaryPath));
      await rename(temporaryPath, destinationPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  private async request(url: string, timeoutMs = 60_000): Promise<Response> {
    const maxRetries = Math.max(0, this.config.secRetryCount);
    const userAgent = this.config.secUserAgent;

    if (!this.userAgentWarningShown && userAgent.includes('your-email@example.com')) {
      this.logger.warn(
        'SEC_USER_AGENT is using the example email. Replace it with a real contact email to avoid SEC request throttling/blocks.',
      );
      this.userAgentWarningShown = true;
    }

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        await this.acquireThrottleSlot();

        const response = await fetch(url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            'User-Agent': userAgent,
            Accept: 'application/json, text/plain, */*',
          },
        });

        if (!response.ok) {
          await response.body?.cancel();
          throw new HttpStatusError(
            `SEC request failed (${response.status})`,
            response.status,
          );
        }

        return response;
      } catch (error) {
        const status = error instanceof HttpStatusError ? error.status : undefined;
        const retryable = status === 429 || (status !== undefined && status >= 500);
        const isLastAttempt = attempt >= maxRetries;

        if (!retryable || isLastAttempt) {
          throw error;
        }

        const waitMs = 300 * 2 ** attempt;
        this.logger.warn(
          `Retrying SEC request in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await this.sleep(waitMs);
      }
    }

    throw new Error('Unexpected SEC request flow');
  }

  private async applyRateLimit(): Promise<void> {
    const rps = Math.max(1, this.config.secRateLimitRps);
    const minIntervalMs = Math.ceil(1000 / rps);
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;

    if (elapsed < minIntervalMs) {
      await this.sleep(minIntervalMs - elapsed);
    }

    this.lastRequestAt = Date.now();
  }

  private acquireThrottleSlot(): Promise<void> {
    const current = this.throttleQueue.then(async () => {
      await this.applyRateLimit();
    });

    this.throttleQueue = current.catch(() => undefined);
    return current;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  sanitizeDownloadPath(baseDir: string, ...segments: string[]): string {
    const safeSegments = segments.map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, '-'));
    return path.resolve(baseDir, ...safeSegments);
  }
}

export type SubmissionColumns = {
  accessionNumber?: unknown[];
  filingDate?: unknown[];
  reportDate?: unknown[];
  acceptanceDateTime?: unknown[];
  form?: unknown[];
  fileNumber?: unknown[];
  filmNumber?: unknown[];
  items?: unknown[];
  size?: unknown[];
  isXBRL?: unknown[];
  isInlineXBRL?: unknown[];
  primaryDocument?: unknown[];
  primaryDocDescription?: unknown[];
};

export type SubmissionPayload = SubmissionColumns & {
  cik?: string | number;
  name?: string;
  tickers?: string[];
  sic?: string | number;
  filings?: {
    recent?: SubmissionColumns;
    files?: Array<{ name: string; filingFrom?: string; filingTo?: string }>;
  };
};

export type CompanyTickerRecord = { cik_str: number; ticker: string; title: string };
