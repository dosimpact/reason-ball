import { Inject, Injectable, Logger } from '@nestjs/common';
import { writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { AppConfigService } from '../config/app.config';

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

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  async getJson<T>(url: string): Promise<T> {
    const response = await this.request(url);
    return (await response.json()) as T;
  }

  async downloadFile(url: string, destinationPath: string): Promise<void> {
    const response = await this.request(url);
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(destinationPath, bytes);
  }

  private async request(url: string): Promise<Response> {
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
          headers: {
            'User-Agent': userAgent,
            Accept: 'application/json, text/plain, */*',
          },
        });

        if (!response.ok) {
          const body = await response.text();
          throw new HttpStatusError(
            `SEC request failed (${response.status}): ${body.slice(0, 200)}`,
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
