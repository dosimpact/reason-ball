import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MAX_COMPANY_PAGE_SIZE, JobCorrelationOptions } from '../entity/company.dto';
import { formatCik, formatCorrelation, tryNormalizeCik, tryNormalizeTicker } from '../../lib/sec/sec.utils';
import { CompanyTickerRecord, SecClientService } from '../../lib/sec/sec.client';
import { Company } from '../entity/company.entity';

type CompaniesListOptions = { limit?: number; page?: number; pageSize?: number; cik?: string; ticker?: string; q?: string };

const DEFAULT_LIST_LIMIT = 50;

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);
  private static readonly TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @Inject(SecClientService)
    private readonly secClient: SecClientService,
  ) { }

  async syncCompanies(options: JobCorrelationOptions = {}): Promise<{ syncedCount: number; }> {
    // Refreshes local master company table from SEC ticker snapshot.
    this.logger.log(`Syncing SEC company list${formatCorrelation(options)}...`);
    const payload = await this.secClient.getJson<Record<string, CompanyTickerRecord>>(
      CompanyService.TICKERS_URL,
    );

    const normalizedRows: Array<Partial<Company>> = Object.values(payload)
      .filter((item) => Number.isFinite(item.cik_str) && item.title)
      .map((item) => ({
        cik: formatCik(item.cik_str),
        ticker: item.ticker?.trim()?.toUpperCase() || null,
        name: item.title.trim(),
        sic: null,
      }));

    const deduplicatedByCik = new Map<string, Partial<Company>>();
    for (const row of normalizedRows) {
      deduplicatedByCik.set(row.cik as string, row);
    }
    const rows = Array.from(deduplicatedByCik.values());

    if (rows.length === 0) {
      this.logger.warn(`No companies found in SEC ticker payload${formatCorrelation(options)}.`);
      return { syncedCount: 0 };
    }

    await this.companyRepository.upsert(rows, ['cik']);
    this.logger.log(`Companies synced: ${rows.length}${formatCorrelation(options)}`);
    return { syncedCount: rows.length };
  }

  async listCompanies(options: CompaniesListOptions = {}) {
    const page = options.page ?? 1;
    const pageSize = this.normalizeLimit(options.pageSize ?? options.limit);
    const cik = tryNormalizeCik(options.cik);
    const ticker = tryNormalizeTicker(options.ticker);
    const q = this.normalizeOptionalText(options.q);

    const query = this.companyRepository
      .createQueryBuilder('company')
      .where("NULLIF(BTRIM(company.ticker), '') IS NOT NULL")
      .orderBy('company.updated_at', 'DESC')
      .addOrderBy('company.cik', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (cik) {
      query.andWhere('company.cik = :cik', { cik });
    }

    if (ticker) {
      query.andWhere('company.ticker = :ticker', { ticker });
    }

    if (q) {
      const keyword = `%${q}%`;
      query.andWhere('(company.name ILIKE :keyword OR company.ticker ILIKE :keyword)', {
        keyword,
      });
    }

    const [items, totalItems] = await query.getManyAndCount();
    const filingCounts = await this.loadFilingCounts(items.map(item => item.cik));
    const totalPages = Math.ceil(totalItems / pageSize);
    return {
      items: items.map(item => ({ ...item, filingCounts: filingCounts.get(item.cik) ?? { total: 0, byFormType: [] } })),
      pagination: { page, pageSize, totalItems, totalPages, hasNextPage: page < totalPages },
    };
  }

  private async loadFilingCounts(ciks: string[]) {
    const counts = new Map<string, { total: number; byFormType: { formType: string; count: number }[] }>();
    if (!ciks.length) return counts;
    const rows: { cik: string; formType: string; count: string }[] = await this.companyRepository.manager.query(
      `SELECT cik, form_type AS "formType", count(*) AS count
       FROM filings WHERE cik = ANY($1::varchar[])
       GROUP BY cik, form_type ORDER BY cik, form_type`,
      [ciks],
    );
    for (const row of rows) {
      const count = Number(row.count);
      const entry = counts.get(row.cik) ?? { total: 0, byFormType: [] };
      entry.total += count;
      entry.byFormType.push({ formType: row.formType, count });
      counts.set(row.cik, entry);
    }
    return counts;
  }

  private normalizeLimit(raw: number | undefined): number {
    if (raw === undefined || raw === null || !Number.isFinite(raw)) {
      return DEFAULT_LIST_LIMIT;
    }

    const normalized = Math.floor(raw);
    if (normalized <= 0) {
      return DEFAULT_LIST_LIMIT;
    }

    return Math.min(normalized, MAX_COMPANY_PAGE_SIZE);
  }

  private normalizeOptionalText(raw: string | undefined): string | undefined {
    if (!raw) {
      return undefined;
    }

    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

}
