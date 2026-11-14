import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { SecModelingClient } from '../../lib/sec-modeling/sec-modeling.client';
import { SecModelingStore } from './sec-modeling.store';

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

@Injectable()
export class SecModelingService {
  constructor(readonly store: SecModelingStore, readonly client: SecModelingClient) {}
  async create(cik: string, accessionNo: string, stage: number, body: any = {}, retryOf?: string): Promise<any> {
    [cik, accessionNo] = filingIdentity(cik, accessionNo);
    const model = stage === 3 ? 'gpt-6-luna' : body?.extractionModel || 'gpt-5.6-sol';
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
    return this.create(run.cik, run.accessionNo, run.stage, run.config, run.id);
  }
  async filings(limit: number, offset: number, cik?: string): Promise<any> {
    const result = await this.store.filings(limit, offset, cik);
    result.items = await Promise.all(result.items.map(async (filing: any) => {
      const runs = await this.store.runs(100, 0, filing.cik, filing.accessionNo);
      let published: any = {};
      let serviceError: string | undefined;
      try { published = (await this.client.request(`/internal/sec-modeling/filings/${filing.cik}/${filing.accessionNo}/status`)).stages || {}; }
      catch { serviceError = 'Modeling service unavailable'; }
      const stages: Record<string, any> = {};
      for (const stage of [1, 2, 3]) {
        const latestRun = runs.items.find((run: any) => run.stage === stage);
        const generation = published[String(stage)];
        const readiness = !filing.hasSource || (stage === 2 && !published['1']?.generationId) ? 'input_required'
          : generation && (generation.sourceHash !== filing.sourceHash || (stage === 2 && generation.inputGenerationId !== published['1']?.generationId)) ? 'stale'
          : generation ? 'ready' : 'unprocessed';
        const supported = (stage === 3 ? ['10-K', '10-Q'] : ['10-K', '10-K/A']).includes(filing.formType);
        const runStatus = latestRun?.status;
        const activeRun = runStatus === 'RUNNING' || runStatus === 'QUEUED';
        // Publication is authoritative: historical successful runs survive graph resets.
        const status = !supported ? 'unsupported' : activeRun ? runStatus
          : serviceError ? 'unavailable' : generation ? readiness
          : runStatus === 'FAILED' || runStatus === 'CANCELLED' ? runStatus : readiness;
        stages[stage] = { ...generation, readiness: supported ? readiness : 'unsupported', status, latestRun };
      }
      return { ...filing, stages, serviceError };
    }));
    return result;
  }
}
