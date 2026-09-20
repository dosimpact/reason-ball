import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BadRequestException, PipeTransform } from '@nestjs/common';
import { readCompanyPageNumber, readOptionalCik, readOptionalTicker, readOptionalText } from './request-validation';
export const MAX_COMPANY_PAGE_SIZE = 100_000;
export class CompanyDto {
  @ApiProperty({ type: String, description: 'SEC 회사 고유 식별자(CIK). 10자리 문자열로 정규화됩니다.', example: '0000320193' })
  cik!: string;

  @ApiPropertyOptional({ type: String, description: '거래소 티커 심볼. 비상장 또는 원본 누락 시 null입니다.', example: 'AAPL', nullable: true })
  ticker!: string | null;

  @ApiProperty({ type: String, description: 'SEC 원본 기준 회사명입니다.', example: 'Apple Inc.' })
  name!: string;

  @ApiPropertyOptional({ type: Number, description: 'SIC 산업 분류 코드입니다.', example: 3571, nullable: true })
  sic!: number | null;

  @ApiProperty({ type: String, format: 'date-time', description: '레코드 마지막 갱신 시각입니다.', example: '2026-04-15T12:00:00.000Z' })
  updatedAt!: Date;
}

export class CompaniesFilterDto {
  @ApiProperty({ type: Number, example: 1 })
  page!: number;

  @ApiProperty({ type: Number, example: 20, maximum: MAX_COMPANY_PAGE_SIZE })
  pageSize!: number;

  @ApiProperty({ type: Number, description: '조회 최대 건수입니다.', example: 20 })
  limit!: number;

  @ApiPropertyOptional({ type: String, description: '10자리 CIK 필터입니다.', example: '0000320193' })
  cik?: string;

  @ApiPropertyOptional({ type: String, description: '티커 필터입니다.', example: 'AAPL' })
  ticker?: string;

  @ApiPropertyOptional({ type: String, description: '회사명 또는 티커 부분 검색어입니다.', example: 'apple' })
  q?: string;
}

export class CompanySyncJobResponseDto {
  @ApiProperty({ type: String, enum: ['companies:sync'], example: 'companies:sync' })
  job!: 'companies:sync';

  @ApiProperty({ type: String, description: '응답 헤더 x-request-id와 같은 작업 상관관계 ID입니다.', example: 'req_abc123' })
  correlationId!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-04-15T12:00:00.000Z' })
  requestedAt!: string;

  @ApiProperty({ type: Number, description: '동기화된 회사 수입니다.', example: 10234 })
  syncedCount!: number;
}

export class CompaniesPaginationDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 101 })
  totalItems!: number;

  @ApiProperty({ example: 6 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;
}

export class CompaniesListResponseDto {
  @ApiProperty({ type: () => CompaniesPaginationDto })
  pagination!: CompaniesPaginationDto;

  @ApiProperty({ type: () => CompaniesFilterDto })
  filters!: CompaniesFilterDto;

  @ApiProperty({ type: () => [CompanyDto] })
  items!: CompanyDto[];
}

export class CompaniesQueryPipe implements PipeTransform {
  transform(raw: unknown) {
    const query = (raw ?? {}) as Record<string, unknown>;

    const page = readCompanyPageNumber(query.page, 'page', 1);
    const pageSize = Math.min(
      readCompanyPageNumber(query.pageSize ?? query.limit, 'pageSize', 50),
      MAX_COMPANY_PAGE_SIZE,
    );
    if (!Number.isSafeInteger((page - 1) * pageSize)) {
      throw new BadRequestException('Pagination offset is too large.');
    }
    const cik = readOptionalCik(query.cik, 'cik');
    const ticker = readOptionalTicker(query.ticker, 'ticker');
    const q = readOptionalText(query.q, 'q');

    return { page, pageSize, cik, ticker, q };
  }
}
export type CompaniesQueryInput = ReturnType<CompaniesQueryPipe['transform']>;

export type JobCorrelationOptions = { correlationId?: string };
