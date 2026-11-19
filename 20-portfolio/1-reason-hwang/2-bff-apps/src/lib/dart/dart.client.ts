import { BadGatewayException, HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../../shared/config.service';
export type DartEndpoint = 'corpCode.xml' | 'list.json' | 'document.xml' | 'company.json' | 'fnlttSinglAcntAll.json';
export const DART_ENDPOINTS: DartEndpoint[] = ['corpCode.xml', 'list.json', 'document.xml', 'company.json', 'fnlttSinglAcntAll.json'];

export const DART_JSON_MAX_BYTES = 8 * 1024 * 1024;
export const DART_ZIP_MAX_BYTES = 64 * 1024 * 1024;
const ORIGIN = 'https://opendart.fss.or.kr/api/';

@Injectable()
export class DartClient {
  private startQueue: Promise<void> = Promise.resolve();
  private lastStartedAt = 0;

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) { }

  request(endpoint: DartEndpoint, query: Record<string, string>, binary: true): Promise<Buffer>;
  request(endpoint: DartEndpoint, query: Record<string, string>, binary: false): Promise<Record<string, unknown>>;
  async request(endpoint: DartEndpoint, query: Record<string, string>, binary: boolean): Promise<Buffer | Record<string, unknown>> {
    if (!DART_ENDPOINTS.includes(endpoint)) throw new BadGatewayException('지원하지 않는 Open DART API입니다.');
    const key = this.config.dartApiKey;
    if (!key) throw new ServiceUnavailableException('Open DART 서버 인증키가 설정되지 않았습니다.');
    const url = new URL(endpoint, ORIGIN);
    Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
    url.searchParams.set('crtfc_key', key);
    await this.waitForStart();
    try {
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { Accept: binary ? 'application/zip, application/xml' : 'application/json' } });
      if (!response.ok) { await response.body?.cancel(); throw new BadGatewayException('Open DART 서버가 정상 HTTP 응답을 반환하지 않았습니다.'); }
      const bytes = await this.readBounded(response, binary ? DART_ZIP_MAX_BYTES : DART_JSON_MAX_BYTES);
      if (binary) {
        if (bytes.length >= 4 && [0x04034b50, 0x06054b50, 0x08074b50].includes(bytes.readUInt32LE(0))) return bytes;
        const text = bytes.subarray(0, 8192).toString('utf8').split(key).join('[REDACTED]');
        const status = /<status>\s*(\d{3})\s*<\/status>/.exec(text)?.[1] ?? null;
        const message = /<message>([^<]{0,1000})<\/message>/.exec(text)?.[1] ?? '유효한 ZIP 파일이 아닙니다.';
        throw new BadGatewayException({ statusCode: 502, message: 'Open DART 파일을 받지 못했습니다.', dart: { status, message } });
      }
      const data: unknown = JSON.parse(bytes.toString('utf8').split(key).join('[REDACTED]'));
      if (!data || typeof data !== 'object' || Array.isArray(data) || typeof (data as Record<string, unknown>).status !== 'string') throw new BadGatewayException('Open DART JSON 응답 형식이 올바르지 않습니다.');
      return data as Record<string, unknown>;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Never forward fetch errors, upstream URLs, response bodies or credentials.
      throw new BadGatewayException('Open DART 요청에 실패했습니다. 연결 상태와 응답 형식을 확인하세요.');
    }
  }

  private async waitForStart(): Promise<void> {
    const previous = this.startQueue;
    let release!: () => void;
    this.startQueue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      const wait = Math.max(0, 250 - (Date.now() - this.lastStartedAt));
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      this.lastStartedAt = Date.now();
    } finally { release(); }
  }

  private async readBounded(response: Response, limit: number): Promise<Buffer> {
    if (!response.body) throw new BadGatewayException('Open DART 응답 본문이 없습니다.');
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      if (Number(response.headers.get('content-length')) > limit) throw new BadGatewayException('Open DART 응답이 크기 제한을 초과했습니다.');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) throw new BadGatewayException('Open DART 응답이 크기 제한을 초과했습니다.');
        chunks.push(Buffer.from(value));
      }
      return Buffer.concat(chunks, size);
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
}
