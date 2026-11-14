import { AppConfigService } from '../../shared/config.service';
import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface ModelingEvent {
  type: 'progress' | 'completed' | 'error';
  runId?: string;
  generationId?: string;
  workUnitId?: string;
  status?: string;
  counts?: Record<string, number>;
  message?: string;
  code?: string;
  [key: string]: unknown;
}

/** Internal service credentials never appear in browser responses or persisted config. */
@Injectable()
export class SecModelingClient {
  constructor(private readonly config: AppConfigService) {}
  private get base(): string { return this.config.secModelingUrl.replace(/\/$/, ''); }
  private headers(): Record<string, string> {
    const key = this.config.secModelingKey;
    if (!key) throw new ServiceUnavailableException('SEC_MODELING_KEY is not configured');
    return { 'Content-Type': 'application/json', 'X-SEC-Modeling-Key': key };
  }
  async request(path: string, body?: unknown): Promise<any> {
    const response = await fetch(this.base + path, {
      method: body === undefined ? 'GET' : 'POST', headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      if ([400, 404, 409, 422].includes(response.status)) {
        throw new HttpException('Modeling request was rejected', response.status === 422 ? 400 : response.status);
      }
      throw new ServiceUnavailableException(`Modeling service returned ${response.status}`);
    }
    return response.json();
  }
  async execute(stage: number, body: unknown, signal: AbortSignal, onEvent: (event: ModelingEvent) => Promise<void>): Promise<void> {
    const response = await fetch(`${this.base}/internal/sec-modeling/model-${stage}/runs`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(body), signal,
    });
    if (!response.ok || !response.body) throw new Error(`Modeling service returned ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        if (buffer.length > 2_000_000) throw new Error('Modeling progress frame exceeds limit');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) if (line.trim()) await onEvent(JSON.parse(line));
        if (done) { if (buffer.trim()) await onEvent(JSON.parse(buffer)); break; }
      }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
}
