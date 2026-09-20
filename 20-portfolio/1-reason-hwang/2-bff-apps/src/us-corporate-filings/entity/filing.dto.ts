import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  readBody, readCompanyPageNumber, readOptionalBoolean, readOptionalCik,
  readOptionalCikList, readOptionalTickerList, readOptionalTicker, readOptionalDate,
  readOptionalStatus, readOptionalText, readOptionalTextAllowEmpty
} from './request-validation';

export class BackfillBodyDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 30 })
  years?: number;
  @ApiPropertyOptional({ default: true, description: '메타데이터와 함께 원문 수집' })
  downloadDocuments?: boolean;
  @ApiPropertyOptional({ default: false, description: '전체 기업 ZIP 새로 다운로드' })
  refreshArchive?: boolean;
}
export class SelectedBackfillBodyDto extends BackfillBodyDto {
  @ApiPropertyOptional({ type: [String], example: ['0000320193'] })
  ciks?: string[];
  @ApiPropertyOptional({ type: [String], example: ['AAPL'] })
  tickers?: string[];
  @ApiPropertyOptional({ example: '2020-01-01', description: 'years보다 우선' })
  since?: string;
}

export class BackfillBodyPipe implements PipeTransform {
  transform(raw: unknown) {
    const body = readBody(raw);
    const years = body.years === undefined ? 20 : Number(body.years);
    if ((typeof body.years !== 'number' && body.years !== undefined) || !Number.isInteger(years) || years < 1 || years > 30) {
      throw new BadRequestException('years must be an integer between 1 and 30.');
    }
    return {
      years,
      refreshArchive: readOptionalBoolean(body.refreshArchive, 'refreshArchive', false),
      downloadDocuments: readOptionalBoolean(body.downloadDocuments, 'downloadDocuments', true),
    };
  }
}
export class SelectedBackfillPipe implements PipeTransform {
  transform(raw: unknown) {
    const body = readBody(raw);
    const options = new BackfillBodyPipe().transform(body);
    const ciks = readOptionalCikList(body.ciks ?? body.cik, 'ciks');
    const tickers = readOptionalTickerList(body.tickers ?? body.ticker, 'tickers');
    if (!ciks?.length && !tickers?.length) throw new BadRequestException('Specify ciks or tickers.');
    return { ...options, ciks, tickers, since: readOptionalDate(body.since, 'since') };
  }
}
export type BackfillInput = ReturnType<BackfillBodyPipe['transform']>;
export type SelectedBackfillInput = ReturnType<SelectedBackfillPipe['transform']>;

export class FilingsQueryPipe implements PipeTransform {
  transform(raw: unknown) {
    const query = (raw ?? {}) as Record<string, unknown>;
    const page = readCompanyPageNumber(query.page, 'page', 1);
    const pageSize = Math.min(readCompanyPageNumber(query.pageSize ?? query.limit, 'pageSize', 50), 500);
    if (!Number.isSafeInteger((page - 1) * pageSize)) throw new BadRequestException('Pagination offset is too large.');
    return {
      page, pageSize,
      cik: readOptionalCik(query.cik, 'cik'),
      ticker: readOptionalTicker(query.ticker, 'ticker'),
      status: readOptionalStatus(query.status, 'status'),
      since: readOptionalDate(query.since, 'since'),
      formType: readOptionalText(query.formType, 'formType')?.toUpperCase(),
      parserStatus: readOptionalTextAllowEmpty(query.parserStatus),
      includeContent: readOptionalBoolean(query.includeContent, 'includeContent', false),
      includeAmendments: readOptionalBoolean(query.includeAmendments, 'includeAmendments', true),
    };
  }
}
export type FilingsQueryInput = ReturnType<FilingsQueryPipe['transform']>;

export type BackfillProgress = { phase: 'archive' | 'metadata' | 'documents' } & Record<string, unknown>;
export type ReportProgress = (progress: BackfillProgress) => void;

export class FilingContentParamsPipe implements PipeTransform {
  transform(params: Record<string, string>) {
    const cik = readOptionalCik(params.cik, 'cik');
    if (!cik || !/^\d{10}-\d{2}-\d{6}$/.test(params.accessionNo ?? '')) {
      throw new BadRequestException('Provide cik and accessionNo in ##########-##-###### format.');
    }
    return { cik, accessionNo: params.accessionNo };
  }
}
export type FilingContentParams = ReturnType<FilingContentParamsPipe['transform']>;
