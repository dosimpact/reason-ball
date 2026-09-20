import { ConflictException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Company } from '../entity/company.entity';
import { Filing } from '../entity/filing.entity';
import { FilingsQueryInput } from '../entity/filing.dto';

@Injectable()
export class FilingService {
  constructor(@InjectRepository(Filing) private readonly filingRepository: Repository<Filing>) { }

  async getContent(cik: string, accessionNo: string) {
    const filing = await this.filingRepository.createQueryBuilder('filing')
      .select(['filing.cik', 'filing.accessionNo', 'filing.status', 'filing.documentContentType'])
      .addSelect('filing.documentContent')
      .where({ cik, accessionNo }).getOne();
    if (!filing) throw new NotFoundException('Filing not found.');
    if (filing.status !== 'downloaded' || !filing.documentContent) {
      throw new ConflictException('Filing content is not downloaded yet.');
    }
    const mime = filing.documentContentType?.split(';')[0].trim().toLowerCase();
    const contentType = mime && ['text/html', 'application/xhtml+xml', 'application/xml', 'text/xml', 'text/plain'].includes(mime)
      ? mime : 'text/plain';
    return { content: filing.documentContent, contentType: `${contentType}; charset=utf-8` };
  }

  async listFilings(options: FilingsQueryInput) {
    const { page, pageSize } = options;
    const query = this.filingRepository.createQueryBuilder('filing')
      .innerJoin(Company, 'company', 'company.cik = filing.cik');
    if (options.cik) query.andWhere('filing.cik = :cik', { cik: options.cik });
    if (options.ticker) query.andWhere('company.ticker = :ticker', { ticker: options.ticker });
    if (options.status) query.andWhere('filing.status = :status', { status: options.status });
    if (options.formType) query.andWhere('filing.form_type = :formType', { formType: options.formType });
    if (options.since) query.andWhere('filing.filing_date >= :since', { since: options.since });
    if (options.parserStatus !== undefined) query.andWhere('filing.parser_status = :parserStatus', { parserStatus: options.parserStatus });
    const totalItems = await query.clone().getCount();
    query.orderBy('filing.filing_date', 'DESC', 'NULLS LAST')
      .addOrderBy('filing.updated_at', 'DESC').addOrderBy('filing.accession_no', 'ASC')
      .addOrderBy('filing.cik', 'ASC').offset((page - 1) * pageSize).limit(pageSize);
    // Select metadata first: the byte budget includes every repeated nested body in the response.
    const rows = await query.getMany();
    const keys = new Map<string, { cik: string; reportDate: string; formType: ReturnType<typeof In> }>();
    for (const row of rows) {
      if (row.reportDate) keys.set(reportKey(row), {
        cik: row.cik, reportDate: row.reportDate, formType: In([baseForm(row), `${baseForm(row)}/A`]),
      });
    }
    const related = options.includeAmendments && keys.size
      ? await this.filingRepository.find({ where: [...keys.values()], order: { filingDate: 'ASC', accessionNo: 'ASC' } })
      : [];
    const links = rows.map(row => options.includeAmendments ? linkAmendments(row, related) : undefined);
    let bytes = 0;
    const needed = new Map<string, Filing>();
    const include = (row: Filing) => {
      bytes += Number(row.documentSizeBytes ?? 0);
      needed.set(identity(row), row);
    };
    rows.forEach((row, index) => {
      include(row);
      const link = links[index];
      if (link?.original) include(link.original);
      link?.amendments.forEach(include);
    });
    if (options.includeContent && bytes > 64 * 1024 * 1024) {
      throw new PayloadTooLargeException('Report content including amendments exceeds 64 MiB; reduce pageSize');
    }
    if (options.includeContent && needed.size) {
      const contents = await this.filingRepository.createQueryBuilder('filing')
        .where([...needed.values()].map(row => ({ cik: row.cik, accessionNo: row.accessionNo })))
        .addSelect('filing.documentContent').getMany();
      for (const row of contents) needed.set(identity(row), row);
    }
    const present = (row: Filing) => {
      const { documentContent, ...metadata } = needed.get(identity(row)) ?? row;
      return { ...metadata, ...(options.includeContent ? { content: documentContent ?? null } : {}) };
    };
    const items = rows.map((row, index) => {
      const link = links[index];
      return { ...present(row), ...(link ? {
        original: link.original ? present(link.original) : null,
        amendments: link.amendments.map(present),
        amendmentLinkStatus: link.status,
        amendmentLinkBasis: 'company-form-reportDate',
      } : {}) };
    });
    const totalPages = Math.ceil(totalItems / pageSize);
    return { filters: options, pagination: { page, pageSize, totalItems, totalPages, hasNextPage: page < totalPages }, items };
  }
}

function baseForm(filing: Filing): string { return filing.formType.replace(/\/A$/, ''); }
function identity(filing: Filing): string { return `${filing.cik}:${filing.accessionNo}`; }
function reportKey(filing: Filing): string { return `${filing.cik}:${baseForm(filing)}:${filing.reportDate}`; }

// Metadata linkage is conservative; it does not assert that an amendment replaces a full report.
export function linkAmendments(filing: Filing, related: Filing[]) {
  const isAmendment = filing.formType.endsWith('/A');
  if (!filing.reportDate) return { original: isAmendment ? null : filing, amendments: [] as Filing[], status: 'missing-report-date' };
  const group = related.filter(row => reportKey(row) === reportKey(filing));
  const originals = group.filter(row => !row.formType.endsWith('/A'));
  const candidates = (amendment: Filing) => originals.filter(original =>
    original.filingDate && amendment.filingDate && original.filingDate <= amendment.filingDate &&
    (!original.acceptedAt || !amendment.acceptedAt || original.acceptedAt <= amendment.acceptedAt));
  const matches = isAmendment ? candidates(filing) : [filing];
  if (matches.length !== 1) return { original: null, amendments: [filing], status: matches.length ? 'ambiguous-original' : 'missing-original' };
  const original = matches[0];
  const amendments = group.filter(row => {
    if (!row.formType.endsWith('/A')) return false;
    const possible = candidates(row);
    return possible.length === 1 && identity(possible[0]) === identity(original);
  }).sort((a, b) => (a.filingDate ?? '').localeCompare(b.filingDate ?? '') || a.accessionNo.localeCompare(b.accessionNo));
  return { original, amendments, status: 'linked' };
}
