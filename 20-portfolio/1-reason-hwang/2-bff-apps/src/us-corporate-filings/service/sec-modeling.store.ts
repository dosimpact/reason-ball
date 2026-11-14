import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ModelingEvent } from '../../lib/sec-modeling/sec-modeling.client';

const RUN_SELECT = `r.id, r.id AS "runId", j.cik, j.accession_no AS "accessionNo", j.stage,
 r.status, r.config, r.source_hash AS "sourceHash", r.input_generation_id AS "inputGenerationId",
 r.output_generation_id AS "outputGenerationId", r.cancel_requested AS "cancelRequested",
 r.error, r.counts, r.retry_of AS "retryOf", r.created_at AS "createdAt",
 r.started_at AS "startedAt", r.finished_at AS "finishedAt"`;
export interface ModelingRun {
  id: string; runId: string; cik: string; accessionNo: string; stage: number; status: string;
  config: { extractionModel: string }; sourceHash: string; inputGenerationId: string | null;
  outputGenerationId: string | null; cancelRequested: boolean; executionToken?: string;
  [key: string]: any;
}

@Injectable()
export class SecModelingStore {
  constructor(private readonly db: DataSource) {}

  async filing(cik: string, accessionNo: string, source = false): Promise<any> {
    const [filing] = await this.db.query(`SELECT f.cik, f.accession_no AS "accessionNo", f.form_type AS "formType",
      to_char(f.filing_date,'YYYY-MM-DD') AS "filingDate", to_char(f.report_date,'YYYY-MM-DD') AS "reportDate", f.filing_url AS "sourceUrl",
      f.checksum AS "sourceHash", c.name AS "companyName", c.ticker,
      (f.document_content IS NOT NULL) AS "hasSource" ${source ? ', f.document_content AS "sourceHtml"' : ''}
      FROM filings f LEFT JOIN companies c USING(cik) WHERE f.cik=$1 AND f.accession_no=$2`, [cik, accessionNo]);
    if (!filing) throw new NotFoundException('Filing not found');
    return filing;
  }
  async filings(limit: number, offset: number, cik?: string): Promise<any> {
    const items = await this.db.query(`SELECT f.cik, f.accession_no AS "accessionNo", f.form_type AS "formType",
      to_char(f.filing_date,'YYYY-MM-DD') AS "filingDate", to_char(f.report_date,'YYYY-MM-DD') AS "reportDate", f.checksum AS "sourceHash",
      c.name AS "companyName", c.ticker, f.document_content IS NOT NULL AS "hasSource",
      count(*) OVER() AS total FROM filings f LEFT JOIN companies c USING(cik)
      WHERE f.form_type IN ('10-K','10-K/A') AND ($3::text IS NULL OR f.cik=$3)
      ORDER BY f.filing_date DESC NULLS LAST,f.cik,f.accession_no LIMIT $1 OFFSET $2`, [limit, offset, cik || null]);
    const total = items.length ? Number(items[0].total) : Number((await this.db.query(`SELECT count(*) AS total FROM filings WHERE form_type IN ('10-K','10-K/A') AND ($1::text IS NULL OR cik=$1)`, [cik || null]))[0].total);
    return { items: items.map(({ total, ...item }: any) => item), total };
  }
  async create(filing: any, stage: number, config: any, input: string | null, retryOf?: string): Promise<ModelingRun> {
    const id = randomUUID();
    try {
      await this.db.transaction(async manager => {
        const [job] = await manager.query(`INSERT INTO sec_modeling.jobs(id,cik,accession_no,stage)
          VALUES($1,$2,$3,$4) ON CONFLICT(cik,accession_no,stage) DO UPDATE SET cik=EXCLUDED.cik RETURNING id`,
          [randomUUID(), filing.cik, filing.accessionNo, stage]);
        await manager.query(`INSERT INTO sec_modeling.runs(id,job_id,status,config,source_hash,input_generation_id,retry_of)
          VALUES($1,$2,'QUEUED',$3,$4,$5,$6)`, [id, job.id, config, filing.sourceHash, input, retryOf || null]);
        await manager.query('UPDATE sec_modeling.jobs SET latest_run_id=$1 WHERE id=$2', [id, job.id]);
        await manager.query(`INSERT INTO sec_modeling.events(run_id,type,payload) VALUES($1,'queued','{}')`, [id]);
      });
    } catch (error: any) {
      if (error.code === '23505') throw new ConflictException('An active run already exists for this filing and stage');
      throw error;
    }
    return this.run(id);
  }
  async run(id: string): Promise<ModelingRun> {
    const [run] = await this.db.query(`SELECT ${RUN_SELECT} FROM sec_modeling.runs r JOIN sec_modeling.jobs j ON j.id=r.job_id WHERE r.id=$1`, [id]);
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }
  async runs(limit: number, offset: number, cik?: string, accessionNo?: string): Promise<any> {
    const rows = await this.db.query(`SELECT ${RUN_SELECT},count(*) OVER() AS total FROM sec_modeling.runs r
      JOIN sec_modeling.jobs j ON j.id=r.job_id WHERE ($3::text IS NULL OR j.cik=$3) AND ($4::text IS NULL OR j.accession_no=$4)
      ORDER BY r.created_at DESC,r.id DESC LIMIT $1 OFFSET $2`, [limit, offset, cik || null, accessionNo || null]);
    const total = rows.length ? Number(rows[0].total) : Number((await this.db.query(`SELECT count(*) AS total FROM sec_modeling.runs r JOIN sec_modeling.jobs j ON j.id=r.job_id WHERE ($1::text IS NULL OR j.cik=$1) AND ($2::text IS NULL OR j.accession_no=$2)`, [cik || null, accessionNo || null]))[0].total);
    return { items: rows.map(({ total, ...row }: any) => row), total };
  }
  async units(id: string): Promise<{ items: any[]; total: number }> {
    // One snapshot keeps truncation metadata accurate while progress rows are arriving.
    const rows = await this.db.query('SELECT id,status,payload,updated_at AS "updatedAt",count(*) OVER()::int AS total FROM sec_modeling.work_units WHERE run_id=$1 ORDER BY id LIMIT 2000', [id]);
    return { items: rows.map(({ total, ...unit }: any) => unit), total: rows[0]?.total || 0 };
  }
  async events(id: string, cursor: string): Promise<any> {
    await this.run(id);
    const items = await this.db.query('SELECT id::text,type,payload,created_at AS "createdAt" FROM sec_modeling.events WHERE run_id=$1 AND id>$2 ORDER BY id LIMIT 100', [id, cursor]);
    return { items, nextCursor: items[items.length - 1]?.id || cursor };
  }
  async claim(): Promise<ModelingRun | null> {
    const token = randomUUID();
    const id = await this.db.transaction(async manager => {
      // Serialize only the short claim across BFF processes, not the HTTP execution.
      await manager.query('SELECT pg_advisory_xact_lock(1794614400)');
      const [[claimed]] = await manager.query(`UPDATE sec_modeling.runs SET status='RUNNING', execution_token=$1,
        started_at=now(),lease_until=now()+interval '90 seconds' WHERE id=(
        SELECT id FROM sec_modeling.runs WHERE status='QUEUED'
        AND NOT EXISTS(SELECT 1 FROM sec_modeling.runs WHERE status='RUNNING')
        ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id`, [token]);
      return claimed?.id;
    });
    if (!id) return null;
    return { ...await this.run(id), executionToken: token };
  }
  async heartbeat(id: string, token: string): Promise<boolean> {
    const rows = await this.db.query(`UPDATE sec_modeling.runs SET lease_until=now()+interval '90 seconds'
      WHERE id=$1 AND execution_token=$2 AND status='RUNNING' AND lease_until>now() RETURNING id`, [id, token]);
    return rows[1] > 0;
  }
  async progress(run: ModelingRun, event: ModelingEvent): Promise<void> {
    await this.db.transaction(async manager => {
      const rows = await manager.query(`SELECT id FROM sec_modeling.runs WHERE id=$1 AND execution_token=$2
        AND status='RUNNING' AND lease_until>now() FOR UPDATE`, [run.id, run.executionToken]);
      if (!rows.length) throw new Error('Execution lease lost');
      await manager.query('INSERT INTO sec_modeling.events(run_id,type,payload) VALUES($1,$2,$3)', [run.id, event.type, event]);
      if (event.workUnitId) await manager.query(`INSERT INTO sec_modeling.work_units(run_id,id,status,payload) VALUES($1,$2,$3,$4)
        ON CONFLICT(run_id,id) DO UPDATE SET status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=now()`,
        [run.id, event.workUnitId, event.status || 'RUNNING', event]);
    });
  }
  async finish(run: ModelingRun, status: string, result: any, reconciled = false): Promise<void> {
    await this.db.transaction(async manager => {
      const updated = await manager.query(`UPDATE sec_modeling.runs SET status=$3,finished_at=now(),lease_until=NULL,
        output_generation_id=$4,counts=$5,error=$6 WHERE id=$1 AND execution_token=$2 AND status='RUNNING' AND ($7 OR lease_until>now()) RETURNING id`,
        [run.id, run.executionToken, status, result.generationId || null, result.counts || null,
          status === 'FAILED' ? { code: result.code || 'EXECUTION_FAILED', message: result.message || 'Execution failed' } : null, reconciled]);
      if (updated[1]) {
        await this.settleUnits(manager, run.id, status, result);
        await manager.query('INSERT INTO sec_modeling.events(run_id,type,payload) VALUES($1,$2,$3)', [run.id, status.toLowerCase(), result]);
      }
    });
  }
  async cancel(id: string): Promise<ModelingRun> {
    await this.db.transaction(async manager => {
      const updated = await manager.query(`UPDATE sec_modeling.runs SET cancel_requested=true,
        finished_at=CASE WHEN status='QUEUED' THEN now() ELSE finished_at END,
        status=CASE WHEN status='QUEUED' THEN 'CANCELLED' ELSE status END
        WHERE id=$1 AND status IN ('QUEUED','RUNNING') AND NOT cancel_requested RETURNING status`, [id]);
      if (updated[1]) {
        const status = updated[0][0].status;
        if (status === 'CANCELLED') await this.settleUnits(manager, id, status, { code: 'CANCELLED_BEFORE_EXECUTION', message: 'Run cancelled before execution' });
        await manager.query(`INSERT INTO sec_modeling.events(run_id,type,payload)
          VALUES($1,'cancel_requested',$2)`, [id, { status }]);
      }
    });
    return this.run(id);
  }
  async reconcileTerminalUnits(): Promise<void> {
    await this.db.query(`UPDATE sec_modeling.work_units u SET status=r.status,updated_at=now(),
      payload=u.payload || jsonb_build_object('status',r.status,'terminalReason',
        jsonb_build_object('code',coalesce(r.error->>'code','RUN_' || r.status),
                          'message',coalesce(r.error->>'message','Reconciled with terminal run state')))
      FROM sec_modeling.runs r WHERE r.id=u.run_id AND r.status IN ('SUCCEEDED','FAILED','CANCELLED')
      AND u.status NOT IN ('SUCCEEDED','FAILED','CANCELLED','INTERRUPTED')`);
  }
  private async settleUnits(manager: EntityManager, id: string, status: string, result: any): Promise<void> {
    const payload = { status, terminalReason: {
      code: result.code || `RUN_${status}`, message: result.message || `Run finished with ${status}`,
    } };
    await manager.query(`UPDATE sec_modeling.work_units SET status=$2,payload=payload || $3::jsonb,updated_at=now()
      WHERE run_id=$1 AND status NOT IN ('SUCCEEDED','FAILED','CANCELLED','INTERRUPTED')`, [id, status, payload]);
  }
  async expired(): Promise<ModelingRun[]> {
    return this.db.query(`SELECT ${RUN_SELECT},r.execution_token AS "executionToken" FROM sec_modeling.runs r
      JOIN sec_modeling.jobs j ON j.id=r.job_id WHERE r.status='RUNNING' AND r.lease_until<now()`);
  }
}
