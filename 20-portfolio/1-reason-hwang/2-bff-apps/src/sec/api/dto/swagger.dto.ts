import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FilingStatus } from '../../common/db/entities/filing.entity';

const FILING_STATUSES: FilingStatus[] = ['pending', 'downloaded', 'failed'];
const JOB_NAMES = [
  'companies:sync',
  'filings:sync',
  'filings:download',
  'filings:retry-failed',
  'filings:parser-status-updated',
] as const;

type JobName = (typeof JOB_NAMES)[number];

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

export class FilingDto {
  @ApiProperty({ type: String, description: 'SEC accession number입니다.', example: '0000320193-26-000045' })
  accessionNo!: string;

  @ApiProperty({ type: String, description: '제출 회사의 10자리 CIK입니다.', example: '0000320193' })
  cik!: string;

  @ApiProperty({ type: String, description: '공시 폼 타입입니다.', example: '10-K' })
  formType!: string;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'SEC filing date입니다.', example: '2026-02-01', nullable: true })
  filingDate!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', description: '보고 대상 기간 기준일(report date)입니다.', example: '2025-12-28', nullable: true })
  reportDate!: string | null;

  @ApiPropertyOptional({ type: String, description: '원본 제출 문서 파일명입니다.', example: 'aapl-20251228x10k.htm', nullable: true })
  primaryDoc!: string | null;

  @ApiProperty({ type: String, description: 'SEC 아카이브 원문 URL입니다.', example: 'https://www.sec.gov/Archives/edgar/data/320193/000032019326000045/aapl-20251228x10k.htm' })
  filingUrl!: string;

  @ApiProperty({ description: '수집 및 다운로드 파이프라인 상태입니다.', enum: FILING_STATUSES, example: 'downloaded' })
  status!: FilingStatus;

  @ApiPropertyOptional({ type: String, description: '로컬 저장 파일 경로입니다.', example: 'nest-static-data/filings/0000320193/2026/0000320193-26-000045/aapl-20251228x10k.htm', nullable: true })
  filePath!: string | null;

  @ApiPropertyOptional({ type: String, description: '다운로드 파일 SHA-256 체크섬입니다.', example: '1a2b3c4d5e6f...', nullable: true })
  checksum!: string | null;

  @ApiProperty({ type: String, description: 'parser/LLM 후처리 상태 문자열입니다. 초기값은 빈 문자열입니다.', example: 'completed' })
  parserStatus!: string;

  @ApiPropertyOptional({ type: String, description: '마지막 실패 원인 메시지입니다.', example: 'SEC response returned HTTP 403', nullable: true })
  errorMessage!: string | null;

  @ApiProperty({ type: Number, description: '누적 재시도 횟수입니다.', example: 1 })
  retryCount!: number;

  @ApiProperty({ type: String, format: 'date-time', description: '레코드 마지막 갱신 시각입니다.', example: '2026-04-15T12:00:00.000Z' })
  updatedAt!: Date;
}

export class CompaniesFilterDto {
  @ApiProperty({ type: Number, example: 1 })
  page!: number;

  @ApiProperty({ type: Number, example: 20, maximum: 100_000 })
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

export class FilingsFilterDto {
  @ApiProperty({ type: Number, description: '조회 최대 건수입니다.', example: 50 })
  limit!: number;

  @ApiPropertyOptional({ description: '필링 상태 필터입니다.', enum: FILING_STATUSES, example: 'pending' })
  status?: FilingStatus;

  @ApiPropertyOptional({ type: String, description: '10자리 CIK 필터입니다.', example: '0000320193' })
  cik?: string;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'YYYY-MM-DD 기준 필터입니다. 해당 날짜 이후 filing만 조회합니다.', example: '2025-01-01' })
  since?: string;

  @ApiPropertyOptional({ type: String, description: 'parser_status 정확 일치 필터입니다. 빈 문자열도 허용됩니다.', example: 'completed' })
  parserStatus?: string;
}

export class StatusSummaryFilterDto {
  @ApiPropertyOptional({ type: String, description: '10자리 CIK 필터입니다.', example: '0000320193' })
  cik?: string;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'YYYY-MM-DD 기준 필터입니다. 해당 날짜 이후 filing만 집계합니다.', example: '2025-01-01' })
  since?: string;
}

export class CompanySyncJobResponseDto {
  @ApiProperty({ type: String, enum: JOB_NAMES, example: 'companies:sync' })
  job!: JobName;

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

export class FilingSyncJobOptionsDto {
  @ApiProperty({ type: Number, description: '처리할 페이지 번호입니다. 1부터 시작합니다.', example: 1 })
  page!: number;

  @ApiProperty({ type: Number, description: '한 번에 처리할 회사 수입니다.', example: 100 })
  pageSize!: number;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'YYYY-MM-DD 이후 filing만 동기화합니다.', example: '2025-01-01' })
  since?: string;

  @ApiPropertyOptional({ description: '특정 CIK 목록만 동기화합니다. 지정하면 page/pageSize 대신 대상 회사만 처리합니다.', example: ['0000320193'], type: [String] })
  ciks?: string[];

  @ApiPropertyOptional({ description: '특정 ticker 목록만 동기화합니다. 지정하면 page/pageSize 대신 대상 회사만 처리합니다.', example: ['AAPL', 'MSFT'], type: [String] })
  tickers?: string[];
}

export class FilingSyncJobBodyDto {
  @ApiPropertyOptional({ type: Number, description: '처리할 페이지 번호입니다. 기본값은 1입니다.', example: 1 })
  page?: number;

  @ApiPropertyOptional({ type: Number, description: '한 번에 처리할 회사 수입니다. 기본값은 100입니다.', example: 100 })
  pageSize?: number;

  @ApiPropertyOptional({ type: Number, description: '이전 API와의 호환용 별칭입니다. 내부적으로 pageSize와 동일하게 처리됩니다.', example: 100, deprecated: true })
  limitCompanies?: number;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'YYYY-MM-DD 이후 filing만 동기화합니다.', example: '2025-01-01' })
  since?: string;

  @ApiPropertyOptional({ description: '특정 CIK 목록입니다. 배열 또는 콤마 구분 문자열을 API에서 허용합니다.', example: ['0000320193'], type: [String] })
  ciks?: string[];

  @ApiPropertyOptional({ description: '특정 ticker 목록입니다. 배열 또는 콤마 구분 문자열을 API에서 허용합니다.', example: ['AAPL', 'MSFT'], type: [String] })
  tickers?: string[];
}

export class FilingSyncPaginationDto {
  @ApiProperty({ type: Number, description: '현재 처리한 페이지 번호입니다.', example: 1 })
  page!: number;

  @ApiProperty({ type: Number, description: '한 페이지당 회사 수입니다.', example: 100 })
  pageSize!: number;

  @ApiProperty({ type: Number, description: 'companies 테이블 전체 회사 수입니다.', example: 10000 })
  totalCompanies!: number;

  @ApiProperty({ type: Number, description: '전체 페이지 수입니다.', example: 100 })
  totalPages!: number;

  @ApiProperty({ type: Boolean, description: '다음 페이지가 남아있는지 여부입니다.', example: true })
  hasNextPage!: boolean;
}

export class FilingSyncJobResponseDto {
  @ApiProperty({ type: String, enum: JOB_NAMES, example: 'filings:sync' })
  job!: JobName;

  @ApiProperty({ type: String, description: '응답 헤더 x-request-id와 같은 작업 상관관계 ID입니다.', example: 'req_abc123' })
  correlationId!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-04-15T12:00:00.000Z' })
  requestedAt!: string;

  @ApiProperty({ type: () => FilingSyncJobOptionsDto })
  options!: FilingSyncJobOptionsDto;

  @ApiProperty({ type: () => FilingSyncPaginationDto })
  pagination!: FilingSyncPaginationDto;

  @ApiProperty({ type: Number, description: '처리한 회사 수입니다.', example: 100 })
  companiesProcessed!: number;

  @ApiProperty({ type: Number, description: '동기화된 filing 수입니다.', example: 1742 })
  filingsSynced!: number;
}

export class FilingDownloadJobOptionsDto {
  @ApiProperty({ type: Number, description: '다운로드 시도 최대 건수입니다.', example: 200 })
  maxFiles!: number;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'YYYY-MM-DD 이후 filing만 대상으로 제한합니다.', example: '2025-01-01' })
  since?: string;

  @ApiPropertyOptional({ description: '특정 CIK 목록만 다운로드 대상으로 제한합니다.', example: ['0000320193', '0000789019'], type: [String] })
  ciks?: string[];

  @ApiPropertyOptional({ description: '특정 ticker 목록만 다운로드 대상으로 제한합니다.', example: ['AAPL', 'MSFT'], type: [String] })
  tickers?: string[];
}

export class FilingDownloadJobBodyDto {
  @ApiPropertyOptional({ type: Number, description: '다운로드 시도 최대 건수입니다. 기본값은 500입니다.', example: 200 })
  maxFiles?: number;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'YYYY-MM-DD 이후 filing만 대상으로 제한합니다.', example: '2025-01-01' })
  since?: string;

  @ApiPropertyOptional({ description: '특정 CIK 목록입니다. 배열 또는 콤마 구분 문자열을 API에서 허용합니다.', example: ['0000320193', '0000789019'], type: [String] })
  ciks?: string[];

  @ApiPropertyOptional({ description: '특정 ticker 목록입니다. 배열 또는 콤마 구분 문자열을 API에서 허용합니다.', example: ['AAPL', 'MSFT'], type: [String] })
  tickers?: string[];
}

export class FilingDownloadJobResponseDto {
  @ApiProperty({ type: String, enum: JOB_NAMES, example: 'filings:download' })
  job!: JobName;

  @ApiProperty({ type: String, description: '응답 헤더 x-request-id와 같은 작업 상관관계 ID입니다.', example: 'req_abc123' })
  correlationId!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-04-15T12:00:00.000Z' })
  requestedAt!: string;

  @ApiProperty({ type: () => FilingDownloadJobOptionsDto })
  options!: FilingDownloadJobOptionsDto;

  @ApiProperty({ type: Number, description: '다운로드 대상으로 큐잉된 filing 수입니다.', example: 200 })
  queued!: number;

  @ApiProperty({ type: Number, description: '성공적으로 다운로드한 filing 수입니다.', example: 197 })
  downloaded!: number;

  @ApiProperty({ type: Number, description: '다운로드 실패한 filing 수입니다.', example: 3 })
  failed!: number;
}

export class FilingParserStatusUpdateBodyDto {
  @ApiProperty({ type: String, description: '대상 filing의 accession number입니다.', example: '0000320193-26-000045' })
  accessionNo!: string;

  @ApiProperty({ type: String, description: '대상 filing의 10자리 CIK입니다.', example: '0000320193' })
  cik!: string;

  @ApiProperty({ type: String, description: '설정할 parser 상태 문자열입니다. 빈 문자열도 허용됩니다.', example: 'completed' })
  parserStatus!: string;
}

export class FilingParserStatusUpdateResponseDto {
  @ApiProperty({ type: String, enum: JOB_NAMES, example: 'filings:parser-status-updated' })
  job!: string;

  @ApiProperty({ type: String, description: '응답 헤더 x-request-id와 같은 작업 상관관계 ID입니다.', example: 'req_abc123' })
  correlationId!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-04-15T12:00:00.000Z' })
  requestedAt!: string;

  @ApiProperty({ type: String, example: '0000320193-26-000045' })
  accessionNo!: string;

  @ApiProperty({ type: String, example: '0000320193' })
  cik!: string;

  @ApiProperty({ type: String, example: 'completed' })
  parserStatus!: string;
}

export class RetryFailedJobOptionsDto {
  @ApiProperty({ type: Number, description: '재시도 대상으로 조회할 최대 건수입니다.', example: 100 })
  limit!: number;

  @ApiPropertyOptional({ type: String, description: '특정 CIK만 재시도 대상으로 제한합니다.', example: '0000320193' })
  cik?: string;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'YYYY-MM-DD 이후 filing만 재시도 대상으로 제한합니다.', example: '2025-01-01' })
  since?: string;
}

export class RetryFailedJobBodyDto {
  @ApiPropertyOptional({ type: Number, description: '재시도 대상으로 조회할 최대 건수입니다. 기본값은 200입니다.', example: 100 })
  limit?: number;

  @ApiPropertyOptional({ type: String, description: '특정 CIK만 재시도 대상으로 제한합니다.', example: '0000320193' })
  cik?: string;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'YYYY-MM-DD 이후 filing만 재시도 대상으로 제한합니다.', example: '2025-01-01' })
  since?: string;
}

export class RetryFailedJobResponseDto {
  @ApiProperty({ type: String, enum: JOB_NAMES, example: 'filings:retry-failed' })
  job!: JobName;

  @ApiProperty({ type: String, description: '응답 헤더 x-request-id와 같은 작업 상관관계 ID입니다.', example: 'req_abc123' })
  correlationId!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-04-15T12:00:00.000Z' })
  requestedAt!: string;

  @ApiProperty({ type: () => RetryFailedJobOptionsDto })
  options!: RetryFailedJobOptionsDto;

  @ApiProperty({ type: Number, description: 'pending 상태로 되돌린 filing 수입니다.', example: 42 })
  resetCount!: number;
}

export class FilingsStatusSummaryResponseDto {
  @ApiProperty({ type: () => StatusSummaryFilterDto })
  filters!: StatusSummaryFilterDto;

  @ApiProperty({ type: Number, example: 250 })
  total!: number;

  @ApiProperty({ type: Number, example: 31 })
  pending!: number;

  @ApiProperty({ type: Number, example: 210 })
  downloaded!: number;

  @ApiProperty({ type: Number, example: 9 })
  failed!: number;
}

export class FilingsListResponseDto {
  @ApiProperty({ type: () => FilingsFilterDto })
  filters!: FilingsFilterDto;

  @ApiProperty({ type: () => [FilingDto] })
  items!: FilingDto[];
}

export class DownloadedReportsFilterDto {
  @ApiProperty({ type: Number, description: '현재 조회 페이지입니다.', example: 1 })
  page!: number;

  @ApiProperty({ type: Number, description: '페이지당 결과 수입니다.', example: 20 })
  pageSize!: number;

  @ApiPropertyOptional({ type: String, description: '공시 폼 타입 필터입니다.', example: '10-K' })
  formType?: string;

  @ApiPropertyOptional({ type: String, description: '10자리 CIK 필터입니다.', example: '0000320193' })
  cik?: string;

  @ApiPropertyOptional({ type: String, description: '회사 ticker 필터입니다.', example: 'AAPL' })
  ticker?: string;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'YYYY-MM-DD 이후 filing만 조회합니다.', example: '2025-01-01' })
  since?: string;

  @ApiPropertyOptional({ type: String, description: 'parser_status 정확 일치 필터입니다. 빈 문자열도 허용됩니다.', example: '' })
  parserStatus?: string;
}

export class DownloadedReportsPaginationDto {
  @ApiProperty({ type: Number, example: 1 })
  page!: number;

  @ApiProperty({ type: Number, example: 20 })
  pageSize!: number;

  @ApiProperty({ type: Number, example: 120 })
  totalItems!: number;

  @ApiProperty({ type: Number, example: 6 })
  totalPages!: number;

  @ApiProperty({ type: Boolean, example: true })
  hasNextPage!: boolean;
}

export class DownloadedReportDto {
  @ApiProperty({ type: String, example: '0000320193-25-000079' })
  accessionNo!: string;

  @ApiProperty({ type: String, example: '0000320193' })
  cik!: string;

  @ApiPropertyOptional({ type: String, example: 'AAPL', nullable: true })
  ticker!: string | null;

  @ApiProperty({ type: String, example: '10-K' })
  formType!: string;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2025-11-01', nullable: true })
  filingDate!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2025-09-27', nullable: true })
  reportDate!: string | null;

  @ApiPropertyOptional({ type: String, example: 'aapl-20250927.htm', nullable: true })
  primaryDoc!: string | null;

  @ApiProperty({ type: String, example: 'https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm' })
  filingUrl!: string;

  @ApiProperty({ type: String, nullable: true, deprecated: true, description: '레거시 파일 경로. 신규 DB 원문은 null.', example: null })
  filePath!: string | null;

  @ApiPropertyOptional({ type: String, example: '1a2b3c4d5e6f...', nullable: true })
  checksum!: string | null;

  @ApiProperty({ type: String, description: 'parser/LLM 후처리 상태 문자열입니다. 초기값은 빈 문자열입니다.', example: 'parsed' })
  parserStatus!: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-04-15T12:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: String, description: 'PostgreSQL에 저장된 보고서 원문입니다.' })
  content!: string;
}

export class DownloadedReportsResponseDto {
  @ApiProperty({ type: () => DownloadedReportsFilterDto })
  filters!: DownloadedReportsFilterDto;

  @ApiProperty({ type: () => DownloadedReportsPaginationDto })
  pagination!: DownloadedReportsPaginationDto;

  @ApiProperty({ type: () => [DownloadedReportDto] })
  items!: DownloadedReportDto[];
}
