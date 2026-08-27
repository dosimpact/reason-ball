import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { DataSource } from 'typeorm';
import * as yauzl from 'yauzl';
import { AppConfigService } from '../common/config/app.config';
import { SecClientService } from '../common/sec/sec-client.service';

export const SEC_CORE_REPORT_FORMS = [
  '10-K',
  '10-K/A',
  '10-Q',
  '10-Q/A',
  '8-K',
  '8-K/A',
] as const;

type BackfillStatus = 'queued' | 'downloading' | 'running' | 'completed' | 'failed';

export type SecBackfillRun = {
  runId: string;
  status: BackfillStatus;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  heartbeatAt: string | null;
  cutoffDate: string;
  targetForms: string[];
  archiveUrl: string;
  archivePath: string | null;
  archiveBytes: string;
  processedEntries: string;
  companiesUpserted: string;
  filingsSeen: string;
  filingsUpserted: string;
  lastEntry: string | null;
  errorMessage: string | null;
};

export type SecBackfillVerification = {
  runId: string;
  runStatus: BackfillStatus;
  cutoffDate: string;
  targetForms: string[];
  totalFilings: string;
  distinctCompanies: string;
  earliestFilingDate: string | null;
  latestFilingDate: string | null;
  outOfScopeForms: string;
  beforeCutoff: string;
  missingCompanyRows: string;
  missingFilingUrls: string;
  documentsStored: string;
  documentsPending: string;
  declaredDocumentBytes: string;
  formCounts: Array<{ formType: string; count: string }>;
  metadataComplete: boolean;
  documentsComplete: boolean;
};

type StartBackfillOptions = {
  years?: number;
  refreshArchive?: boolean;
};

type SubmissionColumns = {
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

type SubmissionPayload = SubmissionColumns & {
  cik?: string | number;
  name?: string;
  tickers?: string[];
  sic?: string | number;
  filings?: {
    recent?: SubmissionColumns;
  };
};

type CompanyRow = {
  cik: string;
  ticker: string | null;
  name: string;
  sic: number | null;
};

type FilingRow = {
  accessionNo: string;
  cik: string;
  formType: string;
  filingDate: string;
  reportDate: string | null;
  acceptedAt: string | null;
  primaryDoc: string | null;
  primaryDocDescription: string | null;
  filingUrl: string;
  fullSubmissionUrl: string;
  items: string | null;
  fileNumber: string | null;
  filmNumber: string | null;
  fileSize: number | null;
  isXbrl: boolean | null;
  isInlineXbrl: boolean | null;
};

type ProcessingCounters = {
  processedEntries: number;
  companiesUpserted: number;
  filingsSeen: number;
  filingsUpserted: number;
  lastEntry: string | null;
};

@Injectable()
export class SecBackfillService implements OnModuleInit {
  private readonly logger = new Logger(SecBackfillService.name);
  private readonly targetForms = new Set<string>(SEC_CORE_REPORT_FORMS);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: AppConfigService,
    private readonly secClient: SecClientService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query(`
      UPDATE sec_backfill_runs
      SET status = 'failed',
          completed_at = now(),
          heartbeat_at = now(),
          error_message = COALESCE(error_message, 'Backfill process stopped before completion; start a new idempotent run.')
      WHERE status IN ('queued', 'downloading', 'running')
    `);
  }

  async start(options: StartBackfillOptions = {}): Promise<SecBackfillRun> {
    const years = options.years ?? this.config.secBackfillRetentionYears;
    if (!Number.isInteger(years) || years < 1 || years > 30) {
      throw new BadRequestException('years must be an integer between 1 and 30.');
    }

    const runId = randomUUID();
    const cutoffDate = this.cutoffDate(years);
    try {
      await this.dataSource.query(
        `INSERT INTO sec_backfill_runs
          (run_id, status, cutoff_date, target_forms, archive_url, archive_path, heartbeat_at)
         VALUES ($1, 'queued', $2, $3, $4, $5, now())`,
        [
          runId,
          cutoffDate,
          [...SEC_CORE_REPORT_FORMS],
          this.config.secBulkSubmissionsUrl,
          this.config.secBulkArchivePath,
        ],
      );
    } catch (error) {
      if (this.postgresErrorCode(error) === '23505') {
        throw new ConflictException('A SEC backfill run is already active.');
      }
      throw error;
    }

    setImmediate(() => {
      void this.execute(runId, cutoffDate, Boolean(options.refreshArchive));
    });
    return this.get(runId);
  }

  async get(runId: string): Promise<SecBackfillRun> {
    const rows = await this.dataSource.query<SecBackfillRun[]>(
      `${this.runSelect()} WHERE run_id = $1`,
      [runId],
    );
    if (!rows[0]) {
      throw new NotFoundException(`SEC backfill run not found: ${runId}`);
    }
    return rows[0];
  }

  async latest(): Promise<SecBackfillRun | null> {
    const rows = await this.dataSource.query<SecBackfillRun[]>(
      `${this.runSelect()} ORDER BY requested_at DESC LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  async verify(runId: string): Promise<SecBackfillVerification> {
    const run = await this.get(runId);
    const forms = run.targetForms;
    const [summary] = await this.dataSource.query<
      Array<{
        totalFilings: string;
        distinctCompanies: string;
        earliestFilingDate: string | null;
        latestFilingDate: string | null;
        outOfScopeForms: string;
        beforeCutoff: string;
        missingCompanyRows: string;
        missingFilingUrls: string;
        documentsStored: string;
        documentsPending: string;
        declaredDocumentBytes: string;
      }>
    >(
      `SELECT
         count(*)::text AS "totalFilings",
         count(DISTINCT filing.cik)::text AS "distinctCompanies",
         min(filing.filing_date)::text AS "earliestFilingDate",
         max(filing.filing_date)::text AS "latestFilingDate",
         count(*) FILTER (WHERE NOT (filing.form_type = ANY($2::text[])))::text AS "outOfScopeForms",
         count(*) FILTER (WHERE filing.filing_date < $1::date)::text AS "beforeCutoff",
         count(*) FILTER (WHERE company.cik IS NULL)::text AS "missingCompanyRows",
         count(*) FILTER (WHERE filing.filing_url IS NULL OR filing.filing_url = '')::text AS "missingFilingUrls",
         count(*) FILTER (WHERE filing.document_content IS NOT NULL)::text AS "documentsStored",
         count(*) FILTER (WHERE filing.document_content IS NULL)::text AS "documentsPending",
         COALESCE(sum(filing.file_size), 0)::text AS "declaredDocumentBytes"
       FROM filings filing
       LEFT JOIN companies company ON company.cik = filing.cik
       WHERE filing.filing_date >= $1::date
         AND filing.form_type = ANY($2::text[])`,
      [run.cutoffDate, forms],
    );
    const formCounts = await this.dataSource.query<Array<{ formType: string; count: string }>>(
      `SELECT form_type AS "formType", count(*)::text AS count
       FROM filings
       WHERE filing_date >= $1::date AND form_type = ANY($2::text[])
       GROUP BY form_type ORDER BY form_type`,
      [run.cutoffDate, forms],
    );
    const totalFilings = summary?.totalFilings ?? '0';
    return {
      runId,
      runStatus: run.status,
      cutoffDate: run.cutoffDate,
      targetForms: forms,
      totalFilings,
      distinctCompanies: summary?.distinctCompanies ?? '0',
      earliestFilingDate: summary?.earliestFilingDate ?? null,
      latestFilingDate: summary?.latestFilingDate ?? null,
      outOfScopeForms: summary?.outOfScopeForms ?? '0',
      beforeCutoff: summary?.beforeCutoff ?? '0',
      missingCompanyRows: summary?.missingCompanyRows ?? '0',
      missingFilingUrls: summary?.missingFilingUrls ?? '0',
      documentsStored: summary?.documentsStored ?? '0',
      documentsPending: summary?.documentsPending ?? '0',
      declaredDocumentBytes: summary?.declaredDocumentBytes ?? '0',
      formCounts,
      metadataComplete:
        run.status === 'completed' &&
        totalFilings === run.filingsUpserted &&
        summary?.outOfScopeForms === '0' &&
        summary?.beforeCutoff === '0' &&
        summary?.missingCompanyRows === '0' &&
        summary?.missingFilingUrls === '0',
      documentsComplete:
        totalFilings !== '0' && summary?.documentsPending === '0',
    };
  }

  private async execute(runId: string, cutoffDate: string, refreshArchive: boolean): Promise<void> {
    try {
      await this.dataSource.query(
        `UPDATE sec_backfill_runs
         SET status = 'downloading', started_at = now(), heartbeat_at = now()
         WHERE run_id = $1`,
        [runId],
      );
      await this.ensureArchive(runId, refreshArchive);
      await this.dataSource.query(
        `UPDATE sec_backfill_runs SET status = 'running', heartbeat_at = now() WHERE run_id = $1`,
        [runId],
      );
      const counters = await this.processArchive(runId, cutoffDate);
      counters.filingsUpserted = await this.countPersistedFilings(cutoffDate);
      await this.dataSource.query(
        `UPDATE sec_backfill_runs
         SET status = 'completed', completed_at = now(), heartbeat_at = now(),
             processed_entries = $2, companies_upserted = $3, filings_seen = $4,
             filings_upserted = $5, last_entry = $6
         WHERE run_id = $1`,
        [
          runId,
          counters.processedEntries,
          counters.companiesUpserted,
          counters.filingsSeen,
          counters.filingsUpserted,
          counters.lastEntry,
        ],
      );
      this.logger.log(
        `SEC backfill completed runId=${runId} companies=${counters.companiesUpserted} filings=${counters.filingsUpserted}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      this.logger.error(`SEC backfill failed runId=${runId}: ${message}`);
      await this.dataSource.query(
        `UPDATE sec_backfill_runs
         SET status = 'failed', completed_at = now(), heartbeat_at = now(), error_message = $2
         WHERE run_id = $1`,
        [runId, message.slice(0, 8000)],
      );
    }
  }

  private async ensureArchive(runId: string, refreshArchive: boolean): Promise<void> {
    const archivePath = this.config.secBulkArchivePath;
    await mkdir(path.dirname(archivePath), { recursive: true });
    if (!refreshArchive) {
      try {
        const existing = await stat(archivePath);
        if (existing.size > 0) {
          await this.updateArchiveBytes(runId, existing.size);
          this.logger.log(`Reusing SEC bulk archive path=${archivePath} bytes=${existing.size}`);
          return;
        }
      } catch {
        // A missing cache is expected on the first run.
      }
    }

    let lastReported = 0;
    await this.secClient.downloadFile(
      this.config.secBulkSubmissionsUrl,
      archivePath,
      (downloadedBytes) => {
        if (downloadedBytes - lastReported >= 16 * 1024 * 1024) {
          lastReported = downloadedBytes;
          void this.updateArchiveBytes(runId, downloadedBytes);
        }
      },
    );
    const downloaded = await stat(archivePath);
    await this.updateArchiveBytes(runId, downloaded.size);
  }

  private async processArchive(runId: string, cutoffDate: string): Promise<ProcessingCounters> {
    const counters: ProcessingCounters = {
      processedEntries: 0,
      companiesUpserted: 0,
      filingsSeen: 0,
      filingsUpserted: 0,
      lastEntry: null,
    };
    const companyBatch: CompanyRow[] = [];
    const filingBatch: FilingRow[] = [];
    const batchSize = Math.max(50, Math.min(this.config.secBackfillBatchSize, 1000));
    const zipFile = await this.openZip(this.config.secBulkArchivePath);

    await new Promise<void>((resolve, reject) => {
      let processing = false;
      const fail = (error: Error) => {
        zipFile.close();
        reject(error);
      };

      zipFile.on('error', fail);
      zipFile.on('end', () => {
        if (!processing) {
          resolve();
        }
      });
      zipFile.on('entry', (entry: yauzl.Entry) => {
        processing = true;
        void this.processEntry(entry, zipFile, cutoffDate, companyBatch, filingBatch, counters)
          .then(async () => {
            while (companyBatch.length >= batchSize) {
              counters.companiesUpserted += await this.flushCompanies(companyBatch);
            }
            while (filingBatch.length >= batchSize) {
              counters.filingsUpserted += await this.flushFilings(filingBatch);
            }
            counters.processedEntries += 1;
            counters.lastEntry = entry.fileName;
            if (counters.processedEntries % 250 === 0) {
              await this.updateProgress(runId, counters);
            }
            processing = false;
            zipFile.readEntry();
          })
          .catch(fail);
      });
      zipFile.readEntry();
    });

    while (companyBatch.length > 0) {
      counters.companiesUpserted += await this.flushCompanies(companyBatch);
    }
    while (filingBatch.length > 0) {
      counters.filingsUpserted += await this.flushFilings(filingBatch);
    }
    await this.updateProgress(runId, counters);
    return counters;
  }

  private async processEntry(
    entry: yauzl.Entry,
    zipFile: yauzl.ZipFile,
    cutoffDate: string,
    companyBatch: CompanyRow[],
    filingBatch: FilingRow[],
    counters: ProcessingCounters,
  ): Promise<void> {
    if (/\/$/.test(entry.fileName) || !entry.fileName.endsWith('.json')) {
      return;
    }
    const cikMatch = path.basename(entry.fileName).match(/CIK(\d{1,10})/i);
    if (!cikMatch) {
      return;
    }
    const cik = cikMatch[1].padStart(10, '0');
    const payload = JSON.parse(await this.readZipEntry(zipFile, entry)) as SubmissionPayload;
    if (payload.name) {
      const parsedSic = Number.parseInt(String(payload.sic ?? ''), 10);
      companyBatch.push({
        cik,
        ticker: payload.tickers?.[0]?.trim().toUpperCase() || null,
        name: payload.name.trim(),
        sic: Number.isFinite(parsedSic) ? parsedSic : null,
      });
    }

    const columns = payload.filings?.recent ?? payload;
    const accessionNumbers = columns.accessionNumber ?? [];
    for (let index = 0; index < accessionNumbers.length; index += 1) {
      const formType = this.stringAt(columns.form, index)?.toUpperCase();
      const filingDate = this.stringAt(columns.filingDate, index);
      if (!formType || !this.targetForms.has(formType) || !filingDate || filingDate < cutoffDate) {
        continue;
      }
      const accessionNo = this.stringAt(accessionNumbers, index);
      if (!accessionNo) {
        continue;
      }
      const primaryDoc = this.stringAt(columns.primaryDocument, index);
      const archiveCik = String(Number.parseInt(cik, 10));
      const accessionPath = accessionNo.replace(/-/g, '');
      const archiveBase = `https://www.sec.gov/Archives/edgar/data/${archiveCik}/${accessionPath}`;
      filingBatch.push({
        accessionNo,
        cik,
        formType,
        filingDate,
        reportDate: this.stringAt(columns.reportDate, index),
        acceptedAt: this.normalizeAcceptedAt(this.stringAt(columns.acceptanceDateTime, index)),
        primaryDoc,
        primaryDocDescription: this.stringAt(columns.primaryDocDescription, index),
        filingUrl: primaryDoc ? `${archiveBase}/${encodeURIComponent(primaryDoc)}` : `${archiveBase}/${accessionNo}.txt`,
        fullSubmissionUrl: `${archiveBase}/${accessionNo}.txt`,
        items: this.stringAt(columns.items, index),
        fileNumber: this.stringAt(columns.fileNumber, index),
        filmNumber: this.stringAt(columns.filmNumber, index),
        fileSize: this.numberAt(columns.size, index),
        isXbrl: this.booleanAt(columns.isXBRL, index),
        isInlineXbrl: this.booleanAt(columns.isInlineXBRL, index),
      });
      counters.filingsSeen += 1;
    }
  }

  private async flushCompanies(batch: CompanyRow[]): Promise<number> {
    if (batch.length === 0) {
      return 0;
    }
    const maxBatchSize = Math.max(50, Math.min(this.config.secBackfillBatchSize, 1000));
    const candidates = batch.splice(0, maxBatchSize);
    const rows = Array.from(
      new Map(candidates.map((row) => [row.cik, row] as const)).values(),
    );
    const values: unknown[] = [];
    const placeholders = rows.map((row, rowIndex) => {
      const offset = rowIndex * 4;
      values.push(row.cik, row.ticker, row.name, row.sic);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    });
    await this.dataSource.query(
      `INSERT INTO companies (cik, ticker, name, sic)
       VALUES ${placeholders.join(',')}
       ON CONFLICT (cik) DO UPDATE SET
         ticker = COALESCE(EXCLUDED.ticker, companies.ticker),
         name = EXCLUDED.name,
         sic = COALESCE(EXCLUDED.sic, companies.sic),
         updated_at = now()`,
      values,
    );
    return rows.length;
  }

  private async flushFilings(batch: FilingRow[]): Promise<number> {
    if (batch.length === 0) {
      return 0;
    }
    const maxBatchSize = Math.max(50, Math.min(this.config.secBackfillBatchSize, 1000));
    const candidates = batch.splice(0, maxBatchSize);
    const rows = Array.from(
      new Map(candidates.map((row) => [`${row.cik}:${row.accessionNo}`, row] as const)).values(),
    );
    const columns = 17;
    const values: unknown[] = [];
    const placeholders = rows.map((row, rowIndex) => {
      const offset = rowIndex * columns;
      values.push(
        row.accessionNo,
        row.cik,
        row.formType,
        row.filingDate,
        row.reportDate,
        row.acceptedAt,
        row.primaryDoc,
        row.primaryDocDescription,
        row.filingUrl,
        row.fullSubmissionUrl,
        row.items,
        row.fileNumber,
        row.filmNumber,
        row.fileSize,
        row.isXbrl,
        row.isInlineXbrl,
        'submissions-bulk',
      );
      return `(${Array.from({ length: columns }, (_, index) => `$${offset + index + 1}`).join(',')})`;
    });
    await this.dataSource.query(
      `INSERT INTO filings
        (accession_no, cik, form_type, filing_date, report_date, accepted_at,
         primary_doc, primary_doc_description, filing_url, full_submission_url,
         items, file_number, film_number, file_size, is_xbrl, is_inline_xbrl, source_kind)
       VALUES ${placeholders.join(',')}
       ON CONFLICT (accession_no, cik) DO UPDATE SET
         form_type = EXCLUDED.form_type,
         filing_date = EXCLUDED.filing_date,
         report_date = EXCLUDED.report_date,
         accepted_at = EXCLUDED.accepted_at,
         primary_doc = EXCLUDED.primary_doc,
         primary_doc_description = EXCLUDED.primary_doc_description,
         filing_url = EXCLUDED.filing_url,
         full_submission_url = EXCLUDED.full_submission_url,
         items = EXCLUDED.items,
         file_number = EXCLUDED.file_number,
         film_number = EXCLUDED.film_number,
         file_size = EXCLUDED.file_size,
         is_xbrl = EXCLUDED.is_xbrl,
         is_inline_xbrl = EXCLUDED.is_inline_xbrl,
         source_kind = EXCLUDED.source_kind,
         updated_at = now()`,
      values,
    );
    return rows.length;
  }

  private async updateProgress(runId: string, counters: ProcessingCounters): Promise<void> {
    await this.dataSource.query(
      `UPDATE sec_backfill_runs
       SET heartbeat_at = now(), processed_entries = $2, companies_upserted = $3,
           filings_seen = $4, filings_upserted = $5, last_entry = $6
       WHERE run_id = $1`,
      [
        runId,
        counters.processedEntries,
        counters.companiesUpserted,
        counters.filingsSeen,
        counters.filingsUpserted,
        counters.lastEntry,
      ],
    );
  }

  private async countPersistedFilings(cutoffDate: string): Promise<number> {
    const rows = await this.dataSource.query<Array<{ count: string }>>(
      `SELECT count(*)::text AS count
       FROM filings
       WHERE filing_date >= $1::date AND form_type = ANY($2::text[])`,
      [cutoffDate, [...SEC_CORE_REPORT_FORMS]],
    );
    return Number.parseInt(rows[0]?.count ?? '0', 10);
  }

  private async updateArchiveBytes(runId: string, bytes: number): Promise<void> {
    await this.dataSource.query(
      'UPDATE sec_backfill_runs SET archive_bytes = $2, heartbeat_at = now() WHERE run_id = $1',
      [runId, bytes],
    );
  }

  private openZip(archivePath: string): Promise<yauzl.ZipFile> {
    return new Promise((resolve, reject) => {
      yauzl.open(archivePath, { lazyEntries: true, autoClose: true }, (error, zipFile) => {
        if (error || !zipFile) {
          reject(error ?? new Error(`Unable to open ZIP archive: ${archivePath}`));
          return;
        }
        resolve(zipFile);
      });
    });
  }

  private readZipEntry(zipFile: yauzl.ZipFile, entry: yauzl.Entry): Promise<string> {
    return new Promise((resolve, reject) => {
      zipFile.openReadStream(entry, (error, stream) => {
        if (error || !stream) {
          reject(error ?? new Error(`Unable to read ZIP entry: ${entry.fileName}`));
          return;
        }
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });
    });
  }

  private cutoffDate(years: number): string {
    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
    return cutoff.toISOString().slice(0, 10);
  }

  private stringAt(values: unknown[] | undefined, index: number): string | null {
    const value = values?.[index];
    if (value === undefined || value === null) {
      return null;
    }
    const normalized = String(value).trim();
    return normalized || null;
  }

  private numberAt(values: unknown[] | undefined, index: number): number | null {
    const parsed = Number(values?.[index]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private booleanAt(values: unknown[] | undefined, index: number): boolean | null {
    const value = values?.[index];
    if (value === undefined || value === null || value === '') {
      return null;
    }
    return value === true || value === 1 || value === '1';
  }

  private normalizeAcceptedAt(value: string | null): string | null {
    if (!value) {
      return null;
    }
    if (/^\d{14}$/.test(value)) {
      return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}Z`;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private postgresErrorCode(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined;
  }

  private runSelect(): string {
    return `SELECT
      run_id AS "runId", status, requested_at AS "requestedAt",
      started_at AS "startedAt", completed_at AS "completedAt",
      heartbeat_at AS "heartbeatAt", to_char(cutoff_date, 'YYYY-MM-DD') AS "cutoffDate",
      target_forms AS "targetForms", archive_url AS "archiveUrl",
      archive_path AS "archivePath", archive_bytes AS "archiveBytes",
      processed_entries AS "processedEntries", companies_upserted AS "companiesUpserted",
      filings_seen AS "filingsSeen", filings_upserted AS "filingsUpserted",
      last_entry AS "lastEntry", error_message AS "errorMessage"
      FROM sec_backfill_runs`;
  }
}
