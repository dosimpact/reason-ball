import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { SecModelingClient } from '../../lib/sec-modeling/sec-modeling.client';
import { SecModelingStore, ModelingFilingFilters } from './sec-modeling.store';

export function stageNumber(value: string): number {
  const stage = Number(value.replace(/^model-/, ''));
  if (![1, 2, 3].includes(stage)) throw new BadRequestException('stage must be 1, 2, or 3');
  return stage;
}
export function filingIdentity(cik: string, accessionNo: string): [string, string] {
  if (!/^\d{1,10}$/.test(cik) || !/^\d{10}-\d{2}-\d{6}$/.test(accessionNo)) throw new BadRequestException('Invalid SEC filing identity');
  return [cik.padStart(10, '0'), accessionNo];
}
export function pageNumber(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value) > max) throw new BadRequestException('Invalid pagination');
  return Number(value);
}

export function modelingFilters(query: Record<string, unknown>): ModelingFilingFilters {
  const text = (key: string): string | undefined => {
    const value = query[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new BadRequestException(`Invalid ${key}`);
    return value.trim() || undefined;
  };
  const cik = text('cik');
  const q = text('q');
  const formType = text('formType');
  const sourceStatus = text('sourceStatus') || 'all';
  if (cik && !/^\d{1,10}$/.test(cik)) throw new BadRequestException('Invalid CIK');
  if (q && q.length > 100) throw new BadRequestException('q exceeds 100 characters');
  if (formType && !['10-K','10-K/A','10-Q'].includes(formType)) throw new BadRequestException('Unsupported formType');
  if (!['all','collected','missing'].includes(sourceStatus)) throw new BadRequestException('Invalid sourceStatus');
  return { ...(cik ? { cik: cik.padStart(10,'0') } : {}), ...(q ? { q } : {}), ...(formType ? { formType } : {}), sourceStatus: sourceStatus as ModelingFilingFilters['sourceStatus'] };
}
export function pageLimit(value: string | undefined, fallback: number): number {
  const limit = pageNumber(value, fallback, 100);
  if (limit < 1) throw new BadRequestException('limit must be at least 1');
  return limit;
}

@Injectable()
export class SecModelingService {
  constructor(readonly store: SecModelingStore, readonly client: SecModelingClient) {}
  async create(cik: string, accessionNo: string, stage: number, body: any = {}, retryOf?: string): Promise<any> {
    [cik, accessionNo] = filingIdentity(cik, accessionNo);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'extractionModel')) throw new BadRequestException('Body must be an object containing only optional extractionModel');
    if ('extractionModel' in body && typeof body.extractionModel !== 'string') throw new BadRequestException('extractionModel must be a string');
    const model = body.extractionModel ?? (stage === 3 ? 'gpt-6-luna' : 'gpt-5.6-sol');
    if (!(stage === 3 ? ['gpt-6-luna'] : ['gpt-5.6-sol', 'gpt-5.6-luna']).includes(model)) throw new BadRequestException('Unsupported extractionModel');
    const filing = await this.store.filing(cik, accessionNo);
    if (!filing.hasSource) throw new ConflictException('Source HTML is required');
    const supportedForms = stage === 3 ? ['10-K', '10-Q'] : ['10-K', '10-K/A'];
    if (!supportedForms.includes(filing.formType)) throw new ConflictException(stage === 3 ? 'Model 3 supports only 10-K and 10-Q' : 'Models 1 and 2 support only 10-K reports');
    let input: string | null = null;
    if (stage === 2) {
      const status = await this.client.request(`/internal/sec-modeling/filings/${cik}/${accessionNo}/status`);
      const prior = status.stages?.['1'];
      if (!prior?.generationId || prior.sourceHash !== filing.sourceHash) throw new ConflictException('A current model-1 generation is required');
      input = prior.generationId;
    }
    const run = await this.store.create(filing, stage, { extractionModel: model }, input, retryOf);
    return { runId: run.id, status: run.status };
  }
  async retry(id: string): Promise<any> {
    const run = await this.store.run(id);
    if (!['FAILED', 'CANCELLED'].includes(run.status)) throw new ConflictException('Only failed or cancelled runs can be retried');
    return this.create(run.cik, run.accessionNo, run.stage, run.config?.extractionModel ? { extractionModel: run.config.extractionModel } : {}, run.id);
  }
  async filings(limit: number, offset: number, cik?: string, filters: ModelingFilingFilters = {}): Promise<any> {
    const result = await this.store.filings(limit, offset, cik, filters);
    if (!result.items.length) return result;
    const latestRuns = await this.store.latestRuns(result.items);
    let publishedByFiling = new Map<string, any>();
    let serviceError: string | undefined;
    try {
      const response = await this.client.request('/internal/sec-modeling/filings/status', {
        filings: result.items.map((f: any) => ({ cik: f.cik, accessionNo: f.accessionNo })),
      });
      if (!Array.isArray(response.items) || response.items.length !== result.items.length || response.items.some((item: any) => !item.stages || typeof item.stages !== 'object' || Array.isArray(item.stages))) throw new Error('Incomplete publication status');
      publishedByFiling = new Map(response.items.map((f: any) => [`${f.cik}:${f.accessionNo}`, f.stages || {}]));
      if (result.items.some((f: any) => !publishedByFiling.has(`${f.cik}:${f.accessionNo}`))) throw new Error('Missing publication status');
    } catch { serviceError = 'Modeling service unavailable'; }
    result.items = result.items.map((filing: any) => {
      const runs = latestRuns.filter(run => run.cik === filing.cik && run.accessionNo === filing.accessionNo);
      const published = serviceError ? {} : publishedByFiling.get(`${filing.cik}:${filing.accessionNo}`) || {};
      const stages: Record<string, any> = {};
      for (const stage of [1, 2, 3]) {
        const latestRun = runs.find((run: any) => run.stage === stage);
        const generation = published[String(stage)];
        const readiness = !filing.hasSource || (stage === 2 && (!published['1']?.generationId || published['1'].sourceHash !== filing.sourceHash)) ? 'input_required'
          : generation && (generation.sourceHash !== filing.sourceHash || (stage === 2 && generation.inputGenerationId !== published['1']?.generationId)) ? 'stale'
          : generation ? 'ready' : 'unprocessed';
        const supported = (stage === 3 ? ['10-K', '10-Q'] : ['10-K', '10-K/A']).includes(filing.formType);
        const runStatus = latestRun?.status;
        const activeRun = runStatus === 'RUNNING' || runStatus === 'QUEUED';
        // Publication is authoritative: historical successful runs survive graph resets.
        const status = !supported ? 'unsupported' : activeRun ? runStatus
          : serviceError ? 'unavailable' : generation ? readiness
          : runStatus === 'FAILED' || runStatus === 'CANCELLED' ? runStatus : readiness;
        stages[stage] = { ...generation, readiness: !supported ? 'unsupported' : serviceError ? 'unavailable' : readiness, status, latestRun };
      }
      return { ...filing, stages, serviceError };
    });
    return result;
  }
}
