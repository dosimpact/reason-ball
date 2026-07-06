import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { In, Repository } from 'typeorm';
import { AppConfigService } from '../common/config/app.config';
import { Company } from '../common/db/entities/company.entity';
import { Filing, FilingStatus } from '../common/db/entities/filing.entity';
import { addWhere } from '../common/db/query-builder';
import { SecClientService } from './sec-client.service';

// 필터링하는 폼, 
//  F-1, F-3, 424B3, SCHEDULE  13G 같은 form은 현재 수집 대상이 아니다.  
const TARGET_FORMS = new Set(['10-K', '10-K/A', '10-Q', '10-Q/A', '6-K', '6-K/A', '20-F', '20-F/A']);

const VALID_FILING_STATUSES: FilingStatus[] = ['pending', 'downloaded', 'failed'];

const DEFAULT_LIMIT_COMPANIES = 100;
const DEFAULT_MAX_FILES = 500;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;
const DEFAULT_RETRY_LIMIT = 200;
const SYNC_PROGRESS_LOG_INTERVAL = 10;
const DOWNLOAD_PROGRESS_LOG_INTERVAL = 10;

type SubmissionsPayload = {
  sic?: number | string | null;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      form?: string[];
      primaryDocument?: string[];
    };
  };
};

export type FilingsCollectOptions = {
  limitCompanies: number;
  since?: string;
  maxFiles: number;
  ciks?: string[];
  tickers?: string[];
  correlationId?: string;
};

export type FilingsSyncOptions = {
  limitCompanies?: number;
  page?: number;
  pageSize?: number;
  since?: string;
  ciks?: string[];
  tickers?: string[];
  correlationId?: string;
};

export type FilingsDownloadOptions = {
  maxFiles?: number;
  ciks?: string[];
  tickers?: string[];
  since?: string;
  correlationId?: string;
};

export type FilingsRetryOptions = {
  limit?: number;
  cik?: string;
  since?: string;
  correlationId?: string;
};

export type FilingParserStatusUpdateOptions = {
  accessionNo: string;
  cik: string;
  parserStatus: string;
  correlationId?: string;
};

export type FilingsListOptions = {
  limit?: number;
  status?: FilingStatus;
  cik?: string;
  since?: string;
  parserStatus?: string;
};

export type DownloadedReportsListOptions = {
  page?: number;
  pageSize?: number;
  formType?: string;
  cik?: string;
  ticker?: string;
  since?: string;
  parserStatus?: string;
};

export type DownloadedReportItem = {
  accessionNo: string;
  cik: string;
  ticker: string | null;
  formType: string;
  filingDate: string | null;
  reportDate: string | null;
  primaryDoc: string | null;
  filingUrl: string;
  filePath: string;
  checksum: string | null;
  parserStatus: string;
  updatedAt: Date;
  content: string;
};

export type DownloadedReportsPage = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  items: DownloadedReportItem[];
};

export type FilingsStatusSummary = {
  total: number;
  pending: number;
  downloaded: number;
  failed: number;
};

export type FilingsSyncSummary = {
  page: number;
  pageSize: number;
  totalCompanies: number;
  totalPages: number;
  hasNextPage: boolean;
  companiesProcessed: number;
  filingsSynced: number;
};

export type FilingsDownloadSummary = {
  queued: number;
  downloaded: number;
  failed: number;
};

export type FilingsCollectSummary = {
  companiesProcessed: number;
  filingsSynced: number;
  downloaded: number;
  failed: number;
};

@Injectable()
export class FilingsCollectorService {
  private readonly logger = new Logger(FilingsCollectorService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Filing)
    private readonly filingRepository: Repository<Filing>,
    @Inject(SecClientService)
    private readonly secClient: SecClientService,
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
  ) {}

  async collectAndDownload(options: FilingsCollectOptions): Promise<FilingsCollectSummary> {
    // End-to-end batch flow:
    // 1) sync filing metadata from SEC, 2) download pending primary documents.
    const limitCompanies = this.normalizePositiveInt(options.limitCompanies, DEFAULT_LIMIT_COMPANIES);
    const ciks = this.normalizeCikList(options.ciks);
    const tickers = this.normalizeTickerList(options.tickers);

    const syncSummary = await this.syncMetadata({
      limitCompanies,
      since: options.since,
      ciks,
      tickers,
      correlationId: options.correlationId,
    });

    const targetCompanies = await this.loadCompanies({
      page: 1,
      pageSize: limitCompanies,
      ciks,
      tickers,
    });
    const downloadSummary = await this.downloadPending({
      ciks: targetCompanies.map((company) => company.cik),
      maxFiles: options.maxFiles,
      since: options.since,
      correlationId: options.correlationId,
    });

    const summary: FilingsCollectSummary = {
      companiesProcessed: syncSummary.companiesProcessed,
      filingsSynced: syncSummary.filingsSynced,
      downloaded: downloadSummary.downloaded,
      failed: downloadSummary.failed,
    };

    this.logger.log(
      `Done. companies=${summary.companiesProcessed}, synced=${summary.filingsSynced}, downloaded=${summary.downloaded}, failed=${summary.failed}${this.formatCorrelation(options)}`,
    );

    return summary;
  }

  async syncMetadata(options: FilingsSyncOptions): Promise<FilingsSyncSummary> {
    // Metadata-only mode used by API/CLI to stage pending filings.
    const ciks = this.normalizeCikList(options.ciks);
    const tickers = this.normalizeTickerList(options.tickers);
    const hasTargetFilter = Boolean(ciks?.length || tickers?.length);
    const page = hasTargetFilter ? 1 : this.normalizePositiveInt(options.page, 1);
    const pageSize = this.normalizePositiveInt(
      options.pageSize ?? options.limitCompanies,
      DEFAULT_LIMIT_COMPANIES,
    );
    const sinceDate = this.parseSinceDate(options.since);
    const companies = await this.loadCompanies({ page, pageSize, ciks, tickers });
    const totalCompanies = hasTargetFilter ? companies.length : await this.companyRepository.count();
    const totalPages = hasTargetFilter
      ? (companies.length > 0 ? 1 : 0)
      : totalCompanies > 0 ? Math.ceil(totalCompanies / pageSize) : 0;

    this.logger.log(
      `Syncing filings metadata for ${companies.length} companies (page=${page}, pageSize=${pageSize}, totalCompanies=${totalCompanies}, since=${sinceDate ?? 'none'}, ciks=${ciks?.join(',') ?? 'all'}, tickers=${tickers?.join(',') ?? 'all'})${this.formatCorrelation(options)}...`,
    );

    const filingsSynced = await this.syncMetadataForCompanies(
      companies,
      sinceDate,
      options.correlationId,
    );
    return {
      page,
      pageSize,
      totalCompanies,
      totalPages,
      hasNextPage: page < totalPages,
      companiesProcessed: companies.length,
      filingsSynced,
    };
  }

  async downloadPending(options: FilingsDownloadOptions): Promise<FilingsDownloadSummary> {
    // Download-only mode that consumes rows already marked as pending.
    const maxFiles = this.normalizeNonNegativeInt(options.maxFiles, DEFAULT_MAX_FILES);
    const sinceDate = this.parseSinceDate(options.since);
    const ciks = await this.resolveTargetCiks({
      ciks: options.ciks,
      tickers: options.tickers,
    });

    const pendingRows = await this.selectPendingRows({ maxFiles, ciks, sinceDate });
    this.logger.log(
      `Downloading pending filings: queued=${pendingRows.length}, maxFiles=${maxFiles}, since=${sinceDate ?? 'none'}, cikFilterCount=${ciks?.length ?? 0}${this.formatCorrelation(options)}`,
    );

    let downloaded = 0;
    let failed = 0;

    for (let index = 0; index < pendingRows.length; index += 1) {
      const filing = pendingRows[index];
      const saveResult = await this.downloadSingleFiling(filing);
      if (saveResult === 'downloaded') {
        downloaded += 1;
      } else {
        failed += 1;
      }

      const processed = index + 1;
      const shouldLogProgress =
        processed === pendingRows.length ||
        processed === 1 ||
        processed % DOWNLOAD_PROGRESS_LOG_INTERVAL === 0;

      if (shouldLogProgress) {
        const progress = pendingRows.length > 0 ? ((processed / pendingRows.length) * 100).toFixed(1) : '100.0';
        this.logger.log(
          `Filing download progress: ${processed}/${pendingRows.length} filings (${progress}%), downloaded=${downloaded}, failed=${failed}, currentAccession=${filing.accessionNo}, currentCik=${filing.cik}${this.formatCorrelation(options)}`,
        );
      }
    }

    return {
      queued: pendingRows.length,
      downloaded,
      failed,
    };
  }

  async retryFailed(options: FilingsRetryOptions): Promise<{ resetCount: number }> {
    const limit = this.normalizePositiveInt(options.limit, DEFAULT_RETRY_LIMIT);
    const sinceDate = this.parseSinceDate(options.since);
    const cik = this.normalizeOptionalCik(options.cik);

    const query = this.filingRepository
      .createQueryBuilder('filing')
      .where('filing.status = :status', { status: 'failed' as FilingStatus })
      .orderBy('filing.updated_at', 'DESC')
      .limit(limit);

    if (cik) {
      query.andWhere('filing.cik = :cik', { cik });
    }

    if (sinceDate) {
      query.andWhere('filing.filing_date >= :sinceDate', { sinceDate });
    }

    const failedRows = await query.getMany();
    if (failedRows.length === 0) {
      return { resetCount: 0 };
    }

    for (const filing of failedRows) {
      filing.status = 'pending';
      filing.errorMessage = null;
    }

    await this.filingRepository.save(failedRows);
    this.logger.log(
      `Retry failed filings reset: resetCount=${failedRows.length}${this.formatCorrelation(options)}`,
    );
    return { resetCount: failedRows.length };
  }

  async getStatusSummary(filters: { cik?: string; since?: string } = {}): Promise<FilingsStatusSummary> {
    const cik = this.normalizeOptionalCik(filters.cik);
    const sinceDate = this.parseSinceDate(filters.since);

    const query = this.filingRepository
      .createQueryBuilder('filing')
      .select('filing.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('filing.status');

    if (cik) {
      addWhere(query, 'filing.cik = :cik', { cik });
    }

    if (sinceDate) {
      addWhere(query, 'filing.filing_date >= :sinceDate', { sinceDate });
    }

    const rows = await query.getRawMany<{ status: FilingStatus; count: string }>();

    const summary: FilingsStatusSummary = {
      total: 0,
      pending: 0,
      downloaded: 0,
      failed: 0,
    };

    for (const row of rows) {
      if (!VALID_FILING_STATUSES.includes(row.status)) {
        continue;
      }

      const count = Number.parseInt(row.count, 10);
      if (!Number.isFinite(count)) {
        continue;
      }

      if (row.status === 'pending') {
        summary.pending = count;
      }

      if (row.status === 'downloaded') {
        summary.downloaded = count;
      }

      if (row.status === 'failed') {
        summary.failed = count;
      }

      summary.total += count;
    }

    return summary;
  }

  async listFilings(options: FilingsListOptions = {}): Promise<Filing[]> {
    const limit = Math.min(
      this.normalizePositiveInt(options.limit, DEFAULT_LIST_LIMIT),
      MAX_LIST_LIMIT,
    );
    const sinceDate = this.parseSinceDate(options.since);
    const cik = this.normalizeOptionalCik(options.cik);
    const parserStatus = this.normalizeOptionalParserStatus(options.parserStatus);

    const query = this.filingRepository
      .createQueryBuilder('filing')
      .orderBy('filing.filing_date', 'DESC', 'NULLS LAST')
      .addOrderBy('filing.updated_at', 'DESC')
      .limit(limit);

    if (cik) {
      addWhere(query, 'filing.cik = :cik', { cik });
    }

    if (options.status) {
      addWhere(query, 'filing.status = :status', { status: options.status });
    }

    if (sinceDate) {
      addWhere(query, 'filing.filing_date >= :sinceDate', { sinceDate });
    }

    if (parserStatus !== undefined) {
      addWhere(query, 'filing.parser_status = :parserStatus', { parserStatus });
    }

    return query.getMany();
  }

  async updateParserStatus(options: FilingParserStatusUpdateOptions): Promise<Filing> {
    const cik = this.normalizeRequiredCik(options.cik);
    const accessionNo = this.normalizeRequiredAccessionNo(options.accessionNo);
    const parserStatus = this.normalizeParserStatus(options.parserStatus);

    const filing = await this.filingRepository.findOneBy({ cik, accessionNo });
    if (!filing) {
      throw new NotFoundException(`Filing not found for cik=${cik}, accessionNo=${accessionNo}`);
    }

    filing.parserStatus = parserStatus;
    const saved = await this.filingRepository.save(filing);
    this.logger.log(
      `Parser status updated: accessionNo=${saved.accessionNo}, cik=${saved.cik}, parserStatus=${saved.parserStatus}${this.formatCorrelation(options)}`,
    );
    return saved;
  }

  async listDownloadedReports(
    options: DownloadedReportsListOptions = {},
  ): Promise<DownloadedReportsPage> {
    const page = this.normalizePositiveInt(options.page, 1);
    const pageSize = Math.min(
      this.normalizePositiveInt(options.pageSize, DEFAULT_LIST_LIMIT),
      MAX_LIST_LIMIT,
    );
    const sinceDate = this.parseSinceDate(options.since);
    const cik = this.normalizeOptionalCik(options.cik);
    const ticker = this.normalizeOptionalTicker(options.ticker);
    const formType = this.normalizeOptionalFormType(options.formType);
    const parserStatus = this.normalizeOptionalParserStatus(options.parserStatus);
    const skip = Math.max(0, (page - 1) * pageSize);

    const baseQuery = this.filingRepository
      .createQueryBuilder('filing')
      .innerJoin(Company, 'company', 'company.cik = filing.cik')
      .where('filing.status = :status', { status: 'downloaded' as FilingStatus })
      .andWhere('filing.file_path IS NOT NULL');

    if (cik) {
      baseQuery.andWhere('filing.cik = :cik', { cik });
    }

    if (ticker) {
      baseQuery.andWhere('company.ticker = :ticker', { ticker });
    }

    if (formType) {
      baseQuery.andWhere('filing.form_type = :formType', { formType });
    }

    if (sinceDate) {
      baseQuery.andWhere('filing.filing_date >= :sinceDate', { sinceDate });
    }

    if (parserStatus !== undefined) {
      baseQuery.andWhere('filing.parser_status = :parserStatus', { parserStatus });
    }

    const totalItems = await baseQuery.clone().getCount();
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0;

    const rows = await baseQuery
      .clone()
      .select([
        'filing.accession_no AS "accessionNo"',
        'filing.cik AS "cik"',
        'company.ticker AS "ticker"',
        'filing.form_type AS "formType"',
        'filing.filing_date AS "filingDate"',
        'filing.report_date AS "reportDate"',
        'filing.primary_doc AS "primaryDoc"',
        'filing.filing_url AS "filingUrl"',
        'filing.file_path AS "filePath"',
        'filing.checksum AS "checksum"',
        'filing.parser_status AS "parserStatus"',
        'filing.updated_at AS "updatedAt"',
      ])
      .orderBy('filing.filing_date', 'DESC', 'NULLS LAST')
      .addOrderBy('filing.updated_at', 'DESC')
      .offset(skip)
      .limit(pageSize)
      .getRawMany<{
        accessionNo: string;
        cik: string;
        ticker: string | null;
        formType: string;
        filingDate: string | null;
        reportDate: string | null;
        primaryDoc: string | null;
        filingUrl: string;
        filePath: string;
        checksum: string | null;
        parserStatus: string;
        updatedAt: Date;
      }>();

    const items = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        content: await readFile(path.resolve(process.cwd(), row.filePath), 'utf8'),
      })),
    );

    return {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      items,
    };
  }

  private normalizePositiveInt(raw: number | undefined, fallback: number): number {
    if (raw === undefined || raw === null || !Number.isFinite(raw)) {
      return fallback;
    }

    const normalized = Math.floor(raw);
    return normalized > 0 ? normalized : fallback;
  }

  private normalizeNonNegativeInt(raw: number | undefined, fallback: number): number {
    if (raw === undefined || raw === null || !Number.isFinite(raw)) {
      return fallback;
    }

    const normalized = Math.floor(raw);
    return normalized >= 0 ? normalized : fallback;
  }

  private normalizeOptionalCik(raw: string | undefined): string | undefined {
    if (!raw) {
      return undefined;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return undefined;
    }

    if (!/^\d{1,10}$/.test(trimmed)) {
      throw new Error(`Invalid CIK: ${raw}`);
    }

    return trimmed.padStart(10, '0');
  }

  private normalizeRequiredCik(raw: string): string {
    const normalized = this.normalizeOptionalCik(raw);
    if (!normalized) {
      throw new Error('CIK is required.');
    }

    return normalized;
  }

  private normalizeRequiredAccessionNo(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error('accessionNo is required.');
    }

    if (!/^[A-Za-z0-9-]{1,32}$/.test(trimmed)) {
      throw new Error(`Invalid accessionNo: ${raw}`);
    }

    return trimmed;
  }

  private normalizeParserStatus(raw: string): string {
    if (raw === undefined || raw === null) {
      return '';
    }

    const normalized = raw.trim();
    if (normalized.length > 255) {
      throw new Error('parserStatus must be 255 characters or fewer.');
    }

    return normalized;
  }

  private normalizeOptionalParserStatus(raw: string | undefined): string | undefined {
    if (raw === undefined || raw === null) {
      return undefined;
    }

    return this.normalizeParserStatus(raw);
  }

  private normalizeCikList(raw: string[] | undefined): string[] | undefined {
    if (!raw || raw.length === 0) {
      return undefined;
    }

    const normalized = Array.from(
      new Set(
        raw
          .map((item) => this.normalizeOptionalCik(item))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeTickerList(raw: string[] | undefined): string[] | undefined {
    if (!raw || raw.length === 0) {
      return undefined;
    }

    const normalized = Array.from(
      new Set(
        raw
          .map((item) => this.normalizeOptionalTicker(item))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeOptionalTicker(raw: string | undefined): string | undefined {
    if (!raw) {
      return undefined;
    }

    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) {
      return undefined;
    }

    if (!/^[A-Z0-9.-]{1,32}$/.test(trimmed)) {
      throw new Error(`Invalid ticker: ${raw}`);
    }

    return trimmed;
  }

  private normalizeOptionalFormType(raw: string | undefined): string | undefined {
    if (!raw) {
      return undefined;
    }

    const trimmed = raw.trim().toUpperCase();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private parseSinceDate(since?: string): string | undefined {
    if (!since) {
      return undefined;
    }

    const trimmed = since.trim();
    if (!trimmed) {
      return undefined;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new Error(`Invalid date format: ${since}. Use YYYY-MM-DD`);
    }

    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid date value: ${since}`);
    }

    return trimmed;
  }

  private async loadCompanies(options: {
    page: number;
    pageSize: number;
    ciks?: string[];
    tickers?: string[];
  }): Promise<Company[]> {
    const { page, pageSize, ciks, tickers } = options;
    if (ciks?.length || tickers?.length) {
      const query = this.companyRepository
        .createQueryBuilder('company')
        .orderBy('company.cik', 'ASC');

      if (ciks?.length) {
        addWhere(query, 'company.cik IN (:...ciks)', { ciks });
      }

      if (tickers?.length) {
        if (ciks?.length) {
          query.orWhere('company.ticker IN (:...tickers)', { tickers });
        } else {
          query.where('company.ticker IN (:...tickers)', { tickers });
        }
      }

      const companies = await query.getMany();
      if (companies.length === 0) {
        throw new Error(
          `No companies found for ciks=${ciks?.join(',') ?? 'none'}, tickers=${tickers?.join(',') ?? 'none'}. Run companies:sync first or check target symbols.`,
        );
      }

      return companies;
    }

    const skip = Math.max(0, (page - 1) * pageSize);
    const companies = await this.companyRepository.find({
      order: { cik: 'ASC' },
      skip,
      take: Math.max(1, pageSize),
    });

    if (companies.length === 0) {
      throw new Error(
        skip === 0
          ? 'No companies in DB. Run companies:sync first.'
          : `No companies found for page=${page}, pageSize=${pageSize}.`,
      );
    }

    return companies;
  }

  private async resolveTargetCiks(options: {
    ciks?: string[];
    tickers?: string[];
  }): Promise<string[] | undefined> {
    const ciks = this.normalizeCikList(options.ciks) ?? [];
    const tickers = this.normalizeTickerList(options.tickers);

    if (!tickers?.length) {
      return ciks.length > 0 ? ciks : undefined;
    }

    const companies = await this.loadCompanies({ page: 1, pageSize: tickers.length, tickers });
    return Array.from(new Set([...ciks, ...companies.map((company) => company.cik)]));
  }

  private async syncMetadataForCompanies(
    companies: Company[],
    sinceDate?: string,
    correlationId?: string,
  ): Promise<number> {
    let filingsSynced = 0;
    const totalCompanies = companies.length;

    for (let index = 0; index < companies.length; index += 1) {
      const company = companies[index];
      filingsSynced += await this.syncCompanyFilings(company, sinceDate, correlationId);

      const processed = index + 1;
      const shouldLogProgress =
        processed === totalCompanies ||
        processed === 1 ||
        processed % SYNC_PROGRESS_LOG_INTERVAL === 0;

      if (shouldLogProgress) {
        const progress = totalCompanies > 0 ? ((processed / totalCompanies) * 100).toFixed(1) : '100.0';
        this.logger.log(
          `Filing sync progress: ${processed}/${totalCompanies} companies (${progress}%), filingsSynced=${filingsSynced}, currentCik=${company.cik}${this.formatCorrelation({ correlationId })}`,
        );
      }
    }

    return filingsSynced;
  }

  private async syncCompanyFilings(
    company: Company,
    sinceDate?: string,
    correlationId?: string,
  ): Promise<number> {
    // Pull one company's "recent" submissions and upsert target form types.
    const url = `https://data.sec.gov/submissions/CIK${company.cik}.json`;

    let payload: SubmissionsPayload;
    try {
      payload = await this.secClient.getJson<SubmissionsPayload>(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to fetch submissions for CIK ${company.cik}: ${message}${this.formatCorrelation({ correlationId })}`,
      );
      return 0;
    }

    const sicValue = this.normalizeSic(payload.sic);
    if (sicValue !== company.sic) {
      company.sic = sicValue;
      await this.companyRepository.save(company);
    }

    const recent = payload.filings?.recent;
    if (!recent) {
      return 0;
    }

    const forms = recent.form ?? [];
    const accessionNumbers = recent.accessionNumber ?? [];
    const filingDates = recent.filingDate ?? [];
    const reportDates = recent.reportDate ?? [];
    const primaryDocuments = recent.primaryDocument ?? [];

    const candidates: Array<Partial<Filing>> = [];
    for (let i = 0; i < forms.length; i += 1) {
      const formType = forms[i]?.trim();
      if (!formType || !TARGET_FORMS.has(formType)) {
        continue;
      }

      const accessionNo = accessionNumbers[i]?.trim();
      if (!accessionNo) {
        continue;
      }

      const filingDate = filingDates[i] ?? null;
      if (sinceDate && filingDate && filingDate < sinceDate) {
        continue;
      }

      const primaryDoc = primaryDocuments[i]?.trim() || null;
      const reportDate = reportDates[i] ?? null;

      candidates.push({
        cik: company.cik,
        accessionNo,
        formType,
        filingDate,
        reportDate,
        primaryDoc,
        filingUrl: this.buildFilingUrl(company.cik, accessionNo, primaryDoc),
      });
    }

    if (candidates.length === 0) {
      return 0;
    }

    const existingRows = await this.filingRepository.findBy({
      cik: company.cik,
      accessionNo: In(candidates.map((candidate) => candidate.accessionNo as string)),
    });

    const existingMap = new Map(existingRows.map((row) => [row.accessionNo, row]));
    const rowsToUpsert: Array<Partial<Filing>> = candidates.map((candidate) => {
      const existing = existingMap.get(candidate.accessionNo as string);
      return {
        ...candidate,
        status: existing?.status ?? 'pending',
        filePath: existing?.filePath ?? null,
        checksum: existing?.checksum ?? null,
        errorMessage: existing?.errorMessage ?? null,
        retryCount: existing?.retryCount ?? 0,
      };
    });

    await this.filingRepository.upsert(rowsToUpsert, ['accessionNo', 'cik']);

    return rowsToUpsert.length;
  }

  private async selectPendingRows(options: {
    maxFiles: number;
    ciks?: string[];
    sinceDate?: string;
  }): Promise<Filing[]> {
    const { maxFiles, ciks, sinceDate } = options;

    if (maxFiles <= 0) {
      return [];
    }

    const query = this.filingRepository
      .createQueryBuilder('filing')
      .where('filing.status = :status', { status: 'pending' as FilingStatus })
      .orderBy('filing.filing_date', 'DESC', 'NULLS LAST')
      .addOrderBy('filing.updated_at', 'ASC')
      .limit(maxFiles);

    if (ciks && ciks.length > 0) {
      query.andWhere('filing.cik IN (:...ciks)', { ciks });
    }

    if (sinceDate) {
      query.andWhere('filing.filing_date >= :sinceDate', { sinceDate });
    }

    return query.getMany();
  }

  private async downloadSingleFiling(filing: Filing): Promise<FilingStatus> {
    // Persist lifecycle state per filing (downloaded/failed + checksum/path).
    if (!filing.primaryDoc) {
      filing.status = 'failed';
      filing.errorMessage = 'Missing primary document in SEC metadata';
      filing.retryCount += 1;
      await this.filingRepository.save(filing);
      return filing.status;
    }

    const formTypeSegment = filing.formType.replace(/[^a-zA-Z0-9._-]/g, '-');
    const docName = path.basename(filing.primaryDoc);
    const destinationPath = this.secClient.sanitizeDownloadPath(
      this.config.filingsDir,
      filing.cik,
      formTypeSegment,
      filing.accessionNo,
      docName,
    );

    await mkdir(path.dirname(destinationPath), { recursive: true });

    try {
      await this.secClient.downloadFile(filing.filingUrl, destinationPath);
      filing.status = 'downloaded';
      filing.filePath = path.relative(process.cwd(), destinationPath);
      filing.checksum = await this.calculateSha256(destinationPath);
      filing.errorMessage = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      filing.status = 'failed';
      filing.retryCount += 1;
      filing.errorMessage = message.slice(0, 1000);
    }

    await this.filingRepository.save(filing);
    return filing.status;
  }

  private buildFilingUrl(cik: string, accessionNo: string, primaryDoc: string | null): string {
    const normalizedCik = String(Number.parseInt(cik, 10));
    const accessionNoNoDash = accessionNo.replaceAll('-', '');
    const docSegment = primaryDoc ? `/${primaryDoc}` : '';
    return `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${accessionNoNoDash}${docSegment}`;
  }

  private normalizeSic(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async calculateSha256(filePath: string): Promise<string> {
    const bytes = await readFile(filePath);
    return createHash('sha256').update(bytes).digest('hex');
  }

  private formatCorrelation(options: { correlationId?: string }): string {
    return options.correlationId ? ` correlationId=${options.correlationId}` : '';
  }
}
