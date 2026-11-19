import { AppConfigService } from '../../shared/config.service';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SecModelingClient, ModelingEvent } from '../../lib/sec-modeling/sec-modeling.client';
import { ModelingRun, SecModelingStore } from './sec-modeling.store';

@Injectable()
export class SecModelingExecutor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SecModelingExecutor.name);
  private timer?: NodeJS.Timeout;
  private active?: AbortController;
  private ticking = false;
  private stopped = false;
  constructor(private readonly store: SecModelingStore, private readonly client: SecModelingClient, private readonly config: AppConfigService) {}
  async onModuleInit(): Promise<void> {
    await this.store.reconcileTerminalUnits();
    if (!this.config.secModelingWorkerEnabled || !this.config.secModelingKey) return;
    this.timer = setInterval(() => { void this.tick(); }, 2000);
    this.timer.unref();
  }
  onModuleDestroy(): void { this.stopped = true; clearInterval(this.timer); this.active?.abort(); }
  async tick(): Promise<void> {
    if (this.ticking || this.stopped) return;
    this.ticking = true;
    try {
      for (const run of await this.store.expired()) await this.reconcile(run);
      const run = await this.store.claim();
      if (run) await this.execute(run);
    } catch { this.logger.warn('SEC modeling executor unavailable; durable work will be retried'); }
    finally { this.ticking = false; }
  }
  private async execute(run: ModelingRun): Promise<void> {
    const abort = new AbortController();
    this.active = abort;
    let renewing = false;
    const heartbeat = setInterval(() => {
      if (renewing) return;
      renewing = true;
      void this.renew(run, abort).catch(() => abort.abort()).finally(() => { renewing = false; });
    }, 15000);
    try {
      const filing = await this.store.filing(run.cik, run.accessionNo, run.stage !== 2);
      if (filing.sourceHash !== run.sourceHash) throw new Error('Source changed after run was queued');
      let completed = false;
      await this.client.execute(run.stage, {
        runId: run.id, executionToken: run.executionToken, cik: run.cik, accessionNo: run.accessionNo,
        sourceHtml: filing.sourceHtml, sourceHash: run.sourceHash, inputGenerationId: run.inputGenerationId,
        extractionModel: run.config.extractionModel, metadata: {
          companyName: filing.companyName, ticker: filing.ticker, formType: filing.formType,
          filingDate: filing.filingDate, reportDate: filing.reportDate, sourceUrl: filing.sourceUrl,
        },
      }, abort.signal, async (event: ModelingEvent) => {
        if (event.runId && event.runId !== run.id) throw new Error('Mismatched run event');
        if (completed) throw new Error('Unexpected event after completion');
        await this.store.progress(run, event);
        if (event.type === 'error') throw new Error(event.message || 'Modeling execution failed');
        if (event.type === 'completed') {
          if (!event.generationId) throw new Error('Completion without published generation');
          await this.store.finish(run, 'SUCCEEDED', event);
          completed = true;
        }
      });
      if (!completed) throw new Error('Progress stream ended without completion');
    } catch (error: any) {
      // A lost response may follow a committed Neo4j generation; always reconcile first.
      await this.reconcile(run, error.message).catch(() => undefined);
    } finally { clearInterval(heartbeat); this.active = undefined; }
  }
  private async renew(run: ModelingRun, abort: AbortController): Promise<void> {
    if (!await this.store.heartbeat(run.id, run.executionToken!)) { abort.abort(); return; }
    const current = await this.store.run(run.id);
    if (current.cancelRequested) {
      await this.client.request(`/internal/sec-modeling/runs/${run.id}/cancel`, { executionToken: run.executionToken });
      abort.abort();
    }
  }
  private async reconcile(run: ModelingRun, message = 'Worker interrupted or lease expired'): Promise<void> {
    const remote = await this.client.request(`/internal/sec-modeling/runs/${run.id}`);
    if (remote.status === 'SUCCEEDED' && remote.generationId) {
      await this.store.finish(run, 'SUCCEEDED', remote, true);
      return;
    }
    // Fence the old execution before allowing another run to claim the single worker slot.
    await this.client.request(`/internal/sec-modeling/runs/${run.id}/cancel`, { executionToken: run.executionToken });
    const settled = await this.client.request(`/internal/sec-modeling/runs/${run.id}`);
    if (settled.status === 'SUCCEEDED' && settled.generationId) await this.store.finish(run, 'SUCCEEDED', settled, true);
    else if (settled.status !== 'RUNNING') {
      const current = await this.store.run(run.id);
      await this.store.finish(run, current.cancelRequested ? 'CANCELLED' : 'FAILED', { code: 'INTERRUPTED', message }, true);
    }
    // Remote unavailability leaves RUNNING with an expiring lease, so recovery never guesses.
  }
}
