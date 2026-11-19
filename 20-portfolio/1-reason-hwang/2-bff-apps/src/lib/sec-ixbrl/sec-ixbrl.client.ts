import { HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../../shared/config.service';

export type IxbrlView = 'metadata' | 'facts' | 'document';
export const IXBRL_MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_BODY_BYTES = 64 * 1024 * 1024;

@Injectable()
export class SecIxbrlClient {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) { }

  async extract(view: IxbrlView, input: { cik: string; accessionNo: string; sourceHtml: string; sourceHash: string }, query: Record<string, string>) {
    const key = this.config.secModelingKey;
    if (!key) throw new ServiceUnavailableException('SEC internal service key is not configured');
    const body = JSON.stringify(input);
    if (Buffer.byteLength(input.sourceHtml, 'utf8') > IXBRL_MAX_SOURCE_BYTES || Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw new HttpException('SEC iXBRL source exceeds supported size', 413);
    const params = new URLSearchParams({ view, ...query });
    try {
      const response = await fetch(`${this.config.secModelingUrl.replace(/\/$/, '')}/internal/sec-ixbrl/extract?${params}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SEC-Modeling-Key': key },
        body, redirect: 'error', signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        const status = [400, 404, 409, 413, 422, 503, 504].includes(response.status) ? response.status : 502;
        throw new HttpException('SEC iXBRL extraction was rejected or could not complete', status);
      }
      if (!response.body) throw new ServiceUnavailableException('SEC iXBRL extraction returned no body');
      const reader = response.body.getReader();
      const parts: Buffer[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BODY_BYTES) throw new HttpException('SEC iXBRL response exceeds supported size', 502);
          parts.push(Buffer.from(value));
        }
      } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      const text = Buffer.concat(parts, size).toString('utf8');
      const sourceHash = response.headers.get('x-source-hash');
      const extractorVersion = response.headers.get('x-extractor-version');
      if (view === 'document') {
        if (sourceHash !== input.sourceHash || !extractorVersion || !response.headers.get('content-type')?.includes('text/html')) throw new HttpException('SEC iXBRL document identity is invalid', 502);
        return { html: text, sourceHash, extractorVersion };
      }
      const data = JSON.parse(text);
      if (!data || data.sourceHash !== input.sourceHash || typeof data.extractorVersion !== 'string') throw new HttpException('SEC iXBRL response identity is invalid', 502);
      return data;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('SEC iXBRL extraction service is unavailable');
    }
  }
}
