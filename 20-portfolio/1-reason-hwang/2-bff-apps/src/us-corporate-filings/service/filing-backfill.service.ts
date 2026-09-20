import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadGatewayException,
} from '@nestjs/common';
import { mkdir, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Filing, FilingStatus } from '../entity/filing.entity';
import { Company } from '../entity/company.entity';
import { SelectedBackfillInput, BackfillInput, ReportProgress } from '../entity/filing.dto';
import * as yauzl from 'yauzl';
import { AppConfigService } from '../../shared/config.service';
import { CompanyRow, FilingRow, parseBulkSubmission } from '../../lib/sec/sec.archive';
import { SEC_CORE_REPORT_FORMS } from '../../lib/sec/sec.utils';
import { formatCik } from '../../lib/sec/sec.utils';
import { SubmissionPayload, SecClientService } from '../../lib/sec/sec.client';
import { openZip, readZipEntry } from '../../lib/sec/sec.archive';

type ProcessingCounters = {
  processedEntries: number;
  companiesUpserted: number;
  filingsSeen: number;
  filingsUpserted: number;
  lastEntry: string | null;
};

@Injectable()
export class FilingBackfillService {
  private readonly logger = new Logger(FilingBackfillService.name);
  private bulkRunning = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: AppConfigService,
    private readonly secClient: SecClientService,
    @InjectRepository(Filing) private readonly filingRepository: Repository<Filing>,
    @InjectRepository(Company) private readonly companyRepository: Repository<Company>,
  ) { }

  async backfillAll(options: BackfillInput, report: ReportProgress) {
    if (this.bulkRunning) throw new ConflictException('An all-company backfill is already active in this process.');
    this.bulkRunning = true;
    try {
      const since = this.cutoffDate(options.years);
      await this.ensureArchive(options.refreshArchive, report);
      const counters = await this.processArchive(since, report);
      const documents = options.downloadDocuments
        ? await this.downloadDocuments(since, report)
        : { downloaded: 0, failed: 0 };
      if (!options.downloadDocuments) report({ phase: 'documents', skipped: true });
      return { ...counters, ...documents };
    } finally {
      this.bulkRunning = false;
    }
  }

  async backfillCompanies(options: SelectedBackfillInput, report: ReportProgress) {
    const query = this.companyRepository.createQueryBuilder('company');
    if (options.ciks?.length) query.where('company.cik IN (:...ciks)', { ciks: options.ciks });
    if (options.tickers?.length) query.orWhere('company.ticker IN (:...tickers)', { tickers: options.tickers });
    const companies = await query.getMany();
    const missingCiks = options.ciks?.filter(cik => !companies.some(c => c.cik === cik)) ?? [];
    const missingTickers = options.tickers?.filter(ticker => !companies.some(c => c.ticker === ticker)) ?? [];
    if (!companies.length || missingCiks.length || missingTickers.length) {
      throw new NotFoundException('Requested companies are missing; sync companies first.');
    }
    const since = options.since ?? this.cutoffDate(options.years);
    let filingsSynced = 0;
    let companiesProcessed = 0;
    report({ phase: 'metadata', companiesProcessed, totalCompanies: companies.length });
    for (const company of companies) {
      try {
        const payload = await this.secClient.getJson<SubmissionPayload>(
          `https://data.sec.gov/submissions/CIK${company.cik}.json`,
        );
        const store = async (submission: SubmissionPayload) => {
          const parsed = parseBulkSubmission(company.cik, submission, since);
          while (parsed.companies.length) await this.flushCompanies(parsed.companies);
          while (parsed.filings.length) filingsSynced += await this.flushFilings(parsed.filings, 'submissions');
          report({ phase: 'metadata', cik: company.cik, filingsSynced, companiesProcessed, totalCompanies: companies.length });
        };
        await store(payload);
        for (const file of payload.filings?.files ?? []) {
          if (file.filingTo && file.filingTo < since) continue;
          if (!/^CIK\d{10}-submissions-\d+\.json$/.test(file.name)) {
            throw new Error('Invalid SEC historical submission filename');
          }
          await store(await this.secClient.getJson<SubmissionPayload>(`https://data.sec.gov/submissions/${file.name}`));
        }
        companiesProcessed++;
        report({ phase: 'metadata', cik: company.cik, filingsSynced, companiesProcessed, totalCompanies: companies.length });
      } catch (error) {
        this.logger.warn(`Company backfill failed for ${company.cik}: ${String(error)}`);
        throw new BadGatewayException(`SEC collection failed for ${company.cik}; rerun safely to resume.`);
      }
    }
    const documents = options.downloadDocuments
      ? await this.downloadDocuments(since, report, companies.map(company => company.cik))
      : { downloaded: 0, failed: 0 };
    if (!options.downloadDocuments) report({ phase: 'documents', skipped: true });
    return { companiesProcessed: companies.length, filingsSynced, ...documents };
  }

  private async downloadDocuments(since: string, report: ReportProgress, ciks?: string[]) {
    // Reset failures once per invocation. HTTP retry is bounded in the SEC client.
    const reset = this.filingRepository.createQueryBuilder().update(Filing)
      .set({ status: 'pending', errorMessage: null })
      .where('status = :status AND filing_date >= :since', { status: 'failed', since });
    if (ciks) reset.andWhere('cik IN (:...ciks)', { ciks });
    await reset.execute();
    report({ phase: 'documents', downloaded: 0, failed: 0 });
    let downloaded = 0;
    let failed = 0;
    while (true) {
      const query = this.filingRepository.createQueryBuilder('filing')
        .where('filing.status = :status AND filing.filing_date >= :since', { status: 'pending', since })
        .orderBy('filing.cik', 'ASC').addOrderBy('filing.accession_no', 'ASC').limit(100);
      if (ciks) query.andWhere('filing.cik IN (:...ciks)', { ciks });
      const rows = await query.getMany();
      if (!rows.length) break;
      for (const row of rows) {
        const status = await this.downloadSingleFiling(row);
        if (status === 'downloaded') downloaded++; else failed++;
        report({ phase: 'documents', downloaded, failed, cik: row.cik, accessionNo: row.accessionNo });
      }
    }
    return { downloaded, failed };
  }

  private async downloadSingleFiling(filing: Filing): Promise<FilingStatus> {
    const identity = { accessionNo: filing.accessionNo, cik: filing.cik };
    try {
      const document = await this.secClient.downloadDocument(filing.filingUrl);
      // Network IO is complete before the atomic write. A late worker cannot overwrite success.
      await this.filingRepository.update({ ...identity, status: 'pending' }, {
        ...document,
        documentDownloadedAt: new Date(),
        status: 'downloaded',
        filePath: null,
        errorMessage: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.filingRepository.createQueryBuilder()
        .update(Filing)
        .set({ status: 'failed', retryCount: () => 'retry_count + 1', errorMessage: message.slice(0, 1000) })
        .where('accession_no = :accessionNo AND cik = :cik AND status = :status', { ...identity, status: 'pending' })
        .execute();
    }
    const current = await this.filingRepository.findOneByOrFail(identity);
    return current.status;
  }

  private async ensureArchive(refreshArchive: boolean, report: ReportProgress): Promise<void> {
    report({ phase: 'archive', archiveBytes: 0 });
    const archivePath = this.config.secBulkArchivePath;
    await mkdir(path.dirname(archivePath), { recursive: true });
    if (!refreshArchive) {
      try {
        const existing = await stat(archivePath);
        if (existing.size > 0) {
          report({ phase: 'archive', archiveBytes: existing.size, cached: true });
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
          report({ phase: 'archive', archiveBytes: downloadedBytes });
        }
      },
    );
    const downloaded = await stat(archivePath);
    report({ phase: 'archive', archiveBytes: downloaded.size });
  }

  private async processArchive(cutoffDate: string, report: ReportProgress): Promise<ProcessingCounters> {
    const counters: ProcessingCounters = {
      processedEntries: 0,
      companiesUpserted: 0,
      filingsSeen: 0,
      filingsUpserted: 0,
      lastEntry: null,
    };
    report({ phase: 'metadata', ...counters });
    const companyBatch: CompanyRow[] = [];
    const filingBatch: FilingRow[] = [];
    const batchSize = Math.max(50, Math.min(this.config.secBackfillBatchSize, 1000));
    const zipFile = await openZip(this.config.secBulkArchivePath);

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
              report({ phase: 'metadata', ...counters });
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
    report({ phase: 'metadata', ...counters });
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
    const cik = formatCik(cikMatch[1]);
    const payload = JSON.parse(await readZipEntry(zipFile, entry)) as SubmissionPayload;
    const rows = parseBulkSubmission(cik, payload, cutoffDate);
    for (const company of rows.companies) companyBatch.push(company);
    for (const filing of rows.filings) filingBatch.push(filing);
    counters.filingsSeen += rows.filings.length;
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

  private async flushFilings(batch: FilingRow[], source = 'submissions-bulk'): Promise<number> {
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
        source,
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

  private cutoffDate(years: number): string {
    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
    return cutoff.toISOString().slice(0, 10);
  }

}
