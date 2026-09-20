import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CompaniesSyncService } from '../companies-sync/companies-sync.service';
import { FilingStatus } from '../common/db/entities/filing.entity';
import { SecBackfillService } from '../filings-collector/sec-backfill.service';
import { FilingsCollectorService } from '../filings-collector/filings-collector.service';
import {
  CompaniesListResponseDto,
  CompanySyncJobResponseDto,
  DownloadedReportsResponseDto,
  FilingDownloadJobBodyDto,
  FilingDownloadJobResponseDto,
  FilingParserStatusUpdateBodyDto,
  FilingParserStatusUpdateResponseDto,
  FilingSyncJobBodyDto,
  FilingSyncJobResponseDto,
  FilingsListResponseDto,
  FilingsStatusSummaryResponseDto,
  RetryFailedJobBodyDto,
  RetryFailedJobResponseDto,
} from './dto/swagger.dto';

const VALID_STATUSES: FilingStatus[] = ['pending', 'downloaded', 'failed'];
const REQUEST_ID_HEADER = 'x-request-id';

type RawBody = Record<string, unknown>;
type RawQuery = Record<string, string | string[] | undefined>;

@ApiTags('SEC Collector')
@Controller()
export class CollectorController {
  // Controller role:
  // - validate/normalize external inputs
  // - delegate actual business work to services
  constructor(
    @Inject(CompaniesSyncService)
    private readonly companiesSyncService: CompaniesSyncService,
    @Inject(FilingsCollectorService)
    private readonly filingsCollectorService: FilingsCollectorService,
    @Inject(SecBackfillService)
    private readonly secBackfillService: SecBackfillService,
  ) {}

  @ApiOperation({
    summary: '회사 마스터 동기화',
    description: 'SEC 회사 티커 스냅샷을 읽어 `companies` 테이블을 upsert합니다.',
  })
  @ApiOkResponse({ type: CompanySyncJobResponseDto })
  @Post('company-sync-jobs')
  async createCompanySyncJob(
    @Headers(REQUEST_ID_HEADER) requestId?: string,
  ): Promise<{
    job: 'companies:sync';
    correlationId: string;
    requestedAt: string;
    syncedCount: number;
  }> {
    const correlationId = this.readCorrelationId(requestId);
    const summary = await this.companiesSyncService.syncCompanies({ correlationId });
    return {
      job: 'companies:sync',
      correlationId,
      requestedAt: new Date().toISOString(),
      syncedCount: summary.syncedCount,
    };
  }

  @ApiOperation({
    summary: '회사 목록 조회',
    description: 'CIK, ticker, 검색어로 `companies` 테이블을 조회합니다.',
  })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호. 기본값 1.', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: '페이지 크기. 기본값 50, 최대 500. limit보다 우선합니다.', example: 20 })
  @ApiQuery({ name: 'limit', required: false, description: 'pageSize의 호환 별칭.', example: 50 })
  @ApiQuery({ name: 'cik', required: false, description: '1~10자리 숫자 CIK. 내부에서 10자리로 패딩됩니다.', example: '0000320193' })
  @ApiQuery({ name: 'ticker', required: false, description: '티커 심볼 필터입니다.', example: 'AAPL' })
  @ApiQuery({ name: 'q', required: false, description: '회사명 또는 티커 부분 검색어입니다.', example: 'apple' })
  @ApiOkResponse({ type: CompaniesListResponseDto })
  @ApiBadRequestResponse({ description: '잘못된 page, pageSize, limit, cik, ticker 형식이 들어오면 반환됩니다.' })
  @Get('companies')
  async listCompanies(@Query() query: RawQuery) {
    const page = this.readCompanyPageNumber(query.page, 'page', 1);
    const pageSize = Math.min(
      this.readCompanyPageNumber(query.pageSize ?? query.limit, 'pageSize', 50),
      500,
    );
    if (!Number.isSafeInteger((page - 1) * pageSize)) {
      throw new BadRequestException('Pagination offset is too large.');
    }
    const cik = this.readOptionalCik(query.cik, 'cik');
    const ticker = this.readOptionalTicker(query.ticker, 'ticker');
    const q = this.readOptionalText(query.q, 'q');
    const result = await this.companiesSyncService.listCompanies({ page, pageSize, cik, ticker, q });

    return {
      filters: { limit: pageSize, page, pageSize, cik, ticker, q },
      ...result,
    };
  }

  private readCompanyPageNumber(raw: unknown, field: string, fallback: number): number {
    if (raw === undefined) return fallback;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      throw new BadRequestException(`${field} must be a positive integer.`);
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new BadRequestException(`${field} must be a positive safe integer.`);
    }
    return value;
  }

  @ApiOperation({
    summary: '공시 메타데이터 수집 작업 실행',
    description: '회사별 SEC submissions JSON을 읽어 `filings` 테이블에 pending 항목을 적재합니다.',
  })
  @ApiBody({ type: FilingSyncJobBodyDto, required: false })
  @ApiOkResponse({ type: FilingSyncJobResponseDto })
  @ApiBadRequestResponse({ description: 'limitCompanies 또는 since 형식이 올바르지 않으면 반환됩니다.' })
  @Post('filing-sync-jobs')
  async createFilingSyncJob(
    @Body() rawBody?: unknown,
    @Headers(REQUEST_ID_HEADER) requestId?: string,
  ): Promise<{
    job: 'filings:sync';
    correlationId: string;
    requestedAt: string;
    options: {
      page: number;
      pageSize: number;
      since?: string;
      ciks?: string[];
      tickers?: string[];
    };
    pagination: {
      page: number;
      pageSize: number;
      totalCompanies: number;
      totalPages: number;
      hasNextPage: boolean;
    };
    companiesProcessed: number;
    filingsSynced: number;
  }> {
    const body = this.readBody(rawBody);
    const page = this.readPositiveInt(body.page, 'page', 1);
    const pageSize = this.readPositiveInt(
      body.pageSize ?? body.limitCompanies,
      body.pageSize !== undefined ? 'pageSize' : 'limitCompanies',
      100,
    );
    const since = this.readOptionalDate(body.since, 'since');
    const ciks = this.readOptionalCikList(body.ciks, 'ciks');
    const tickers = this.readOptionalTickerList(body.tickers, 'tickers');
    const correlationId = this.readCorrelationId(requestId);

    const summary = await this.filingsCollectorService.syncMetadata({
      limitCompanies: pageSize,
      page,
      pageSize,
      since,
      ciks,
      tickers,
      correlationId,
    });

    return {
      job: 'filings:sync',
      correlationId,
      requestedAt: new Date().toISOString(),
      options: { page, pageSize, since, ciks, tickers },
      pagination: {
        page: summary.page,
        pageSize: summary.pageSize,
        totalCompanies: summary.totalCompanies,
        totalPages: summary.totalPages,
        hasNextPage: summary.hasNextPage,
      },
      companiesProcessed: summary.companiesProcessed,
      filingsSynced: summary.filingsSynced,
    };
  }

  @ApiOperation({
    summary: '전체 SEC 핵심 공시 bulk backfill 시작',
    description:
      'SEC submissions.zip을 스트리밍 처리하여 최근 N년의 10-K, 10-Q, 8-K 및 수정공시를 PostgreSQL에 idempotent upsert합니다.',
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        years: { type: 'integer', minimum: 1, maximum: 30, default: 20 },
        refreshArchive: { type: 'boolean', default: false },
      },
    },
  })
  @ApiAcceptedResponse({ description: '백필이 백그라운드에서 시작됐으며 run 상태를 반환합니다.' })
  @Post('filing-backfill-jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  async createFilingBackfillJob(@Body() rawBody?: unknown) {
    const body = this.readBody(rawBody);
    const years = this.readPositiveInt(body.years, 'years', 20);
    if (years > 30) {
      throw new BadRequestException('years must be 30 or fewer.');
    }
    const refreshArchive = this.readOptionalBoolean(
      body.refreshArchive,
      'refreshArchive',
      false,
    );
    return this.secBackfillService.start({ years, refreshArchive });
  }

  @ApiOperation({ summary: '가장 최근 SEC bulk backfill 상태 조회' })
  @ApiOkResponse({ description: '최근 run 또는 run이 없으면 null을 반환합니다.' })
  @Get('filing-backfill-jobs/latest')
  async getLatestFilingBackfillJob() {
    return this.secBackfillService.latest();
  }

  @ApiOperation({ summary: 'SEC bulk backfill 상태 조회' })
  @ApiOkResponse({ description: '지정한 run의 진행률과 결과를 반환합니다.' })
  @Get('filing-backfill-jobs/:runId')
  async getFilingBackfillJob(@Param('runId') runId: string) {
    return this.secBackfillService.get(runId);
  }

  @ApiOperation({ summary: 'SEC bulk backfill DB 완전성 검증' })
  @ApiOkResponse({ description: 'form/date/CIK/URL/원문 저장 완전성 지표를 반환합니다.' })
  @Get('filing-backfill-jobs/:runId/verification')
  async verifyFilingBackfillJob(@Param('runId') runId: string) {
    return this.secBackfillService.verify(runId);
  }

  @ApiOperation({
    summary: '공시 원문 다운로드 작업 실행',
    description: '`pending` 상태 filing을 선택해 SEC 원문을 다운로드하고 상태를 갱신합니다.',
  })
  @ApiBody({ type: FilingDownloadJobBodyDto, required: false })
  @ApiOkResponse({ type: FilingDownloadJobResponseDto })
  @ApiBadRequestResponse({ description: 'maxFiles, since, ciks 형식이 올바르지 않으면 반환됩니다.' })
  @Post('filing-download-jobs')
  async createFilingDownloadJob(
    @Body() rawBody?: unknown,
    @Headers(REQUEST_ID_HEADER) requestId?: string,
  ): Promise<{
    job: 'filings:download';
    correlationId: string;
    requestedAt: string;
    options: {
      maxFiles: number;
      since?: string;
      ciks?: string[];
      tickers?: string[];
    };
    queued: number;
    downloaded: number;
    failed: number;
  }> {
    const body = this.readBody(rawBody);
    const maxFiles = this.readNonNegativeInt(body.maxFiles, 'maxFiles', 500);
    const since = this.readOptionalDate(body.since, 'since');
    const ciks = this.readOptionalCikList(body.ciks, 'ciks');
    const tickers = this.readOptionalTickerList(body.tickers, 'tickers');
    const correlationId = this.readCorrelationId(requestId);

    const summary = await this.filingsCollectorService.downloadPending({
      maxFiles,
      since,
      ciks,
      tickers,
      correlationId,
    });

    return {
      job: 'filings:download',
      correlationId,
      requestedAt: new Date().toISOString(),
      options: { maxFiles, since, ciks, tickers },
      queued: summary.queued,
      downloaded: summary.downloaded,
      failed: summary.failed,
    };
  }

  @ApiOperation({
    summary: '실패 건 재시도 큐 복귀',
    description: '`failed` 상태 filing을 다시 `pending` 상태로 되돌립니다.',
  })
  @ApiBody({ type: RetryFailedJobBodyDto, required: false })
  @ApiOkResponse({ type: RetryFailedJobResponseDto })
  @ApiBadRequestResponse({ description: 'limit, cik, since 형식이 올바르지 않으면 반환됩니다.' })
  @Post('filing-retry-jobs')
  async createRetryJob(
    @Body() rawBody?: unknown,
    @Headers(REQUEST_ID_HEADER) requestId?: string,
  ): Promise<{
    job: 'filings:retry-failed';
    correlationId: string;
    requestedAt: string;
    options: { limit: number; cik?: string; since?: string };
    resetCount: number;
  }> {
    const body = this.readBody(rawBody);
    const limit = this.readPositiveInt(body.limit, 'limit', 200);
    const cik = this.readOptionalCik(body.cik, 'cik');
    const since = this.readOptionalDate(body.since, 'since');
    const correlationId = this.readCorrelationId(requestId);

    const summary = await this.filingsCollectorService.retryFailed({
      limit,
      cik,
      since,
      correlationId,
    });

    return {
      job: 'filings:retry-failed',
      correlationId,
      requestedAt: new Date().toISOString(),
      options: { limit, cik, since },
      resetCount: summary.resetCount,
    };
  }

  @ApiOperation({
    summary: '공시 상태 요약 조회',
    description: '조건에 맞는 filing을 상태별로 집계합니다.',
  })
  @ApiQuery({ name: 'cik', required: false, description: '특정 CIK로 집계를 제한합니다.', example: '0000320193' })
  @ApiQuery({ name: 'since', required: false, description: 'YYYY-MM-DD 이후 filing만 집계합니다.', example: '2025-01-01' })
  @ApiOkResponse({ type: FilingsStatusSummaryResponseDto })
  @ApiBadRequestResponse({ description: 'cik 또는 since 형식이 올바르지 않으면 반환됩니다.' })
  @Get('filings/status-summary')
  async getStatusSummary(
    @Query() query: RawQuery,
  ): Promise<{ filters: { cik?: string; since?: string }; total: number; pending: number; downloaded: number; failed: number }> {
    const cik = this.readOptionalCik(query.cik, 'cik');
    const since = this.readOptionalDate(query.since, 'since');
    const summary = await this.filingsCollectorService.getStatusSummary({ cik, since });

    return {
      filters: { cik, since },
      ...summary,
    };
  }

  @ApiOperation({
    summary: '공시 목록 조회',
    description: '상태, CIK, 기간 조건으로 filing 목록을 조회합니다.',
  })
  @ApiQuery({ name: 'limit', required: false, description: '최대 조회 건수. 기본값 50.', example: 50 })
  @ApiQuery({ name: 'status', required: false, description: 'filing 상태 필터입니다.', enum: VALID_STATUSES, example: 'pending' })
  @ApiQuery({ name: 'cik', required: false, description: '특정 CIK로 조회를 제한합니다.', example: '0000320193' })
  @ApiQuery({ name: 'since', required: false, description: 'YYYY-MM-DD 이후 filing만 조회합니다.', example: '2025-01-01' })
  @ApiQuery({ name: 'parserStatus', required: false, description: 'parser_status 정확 일치 필터입니다.', example: 'completed' })
  @ApiOkResponse({ type: FilingsListResponseDto })
  @ApiBadRequestResponse({ description: 'limit, status, cik, since, parserStatus 형식이 올바르지 않으면 반환됩니다.' })
  @Get('filings')
  async listFilings(
    @Query() query: RawQuery,
  ): Promise<{
    filters: { limit: number; status?: FilingStatus; cik?: string; since?: string; parserStatus?: string };
    items: Awaited<ReturnType<FilingsCollectorService['listFilings']>>;
  }> {
    const limit = this.readPositiveInt(query.limit, 'limit', 50);
    const status = this.readOptionalStatus(query.status, 'status');
    const cik = this.readOptionalCik(query.cik, 'cik');
    const since = this.readOptionalDate(query.since, 'since');
    const parserStatus = this.readOptionalTextAllowEmpty(query.parserStatus);

    const items = await this.filingsCollectorService.listFilings({
      limit,
      status,
      cik,
      since,
      parserStatus,
    });

    return {
      filters: { limit, status, cik, since, parserStatus },
      items,
    };
  }

  @ApiOperation({
    summary: '다운로드된 보고서 조회',
    description:
      'downloaded 상태 filing의 PostgreSQL 원문을 JSON으로 반환합니다. filePath는 폐기 예정 nullable 필드입니다.',
  })
  @ApiQuery({ name: 'page', required: false, description: '현재 페이지. 기본값 1.', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: '페이지당 결과 수. 기본값 50.', example: 20 })
  @ApiQuery({ name: 'formType', required: false, description: '공시 폼 타입 필터입니다.', example: '10-K' })
  @ApiQuery({ name: 'cik', required: false, description: '특정 CIK로 조회를 제한합니다.', example: '0000320193' })
  @ApiQuery({ name: 'ticker', required: false, description: '회사 ticker로 조회를 제한합니다.', example: 'AAPL' })
  @ApiQuery({ name: 'since', required: false, description: 'YYYY-MM-DD 이후 filing만 조회합니다.', example: '2025-01-01' })
  @ApiQuery({ name: 'parserStatus', required: false, description: 'parser_status 정확 일치 필터입니다. 빈 문자열도 허용됩니다.', example: '' })
  @ApiOkResponse({ type: DownloadedReportsResponseDto })
  @ApiBadRequestResponse({ description: 'page, pageSize, formType, cik, ticker, since, parserStatus 형식이 올바르지 않으면 반환됩니다.' })
  @Get('filings/downloaded-reports')
  async listDownloadedReports(
    @Query() query: RawQuery,
  ): Promise<{
    filters: {
      page: number;
      pageSize: number;
      formType?: string;
      cik?: string;
      ticker?: string;
      since?: string;
      parserStatus?: string;
    };
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
    };
    items: Awaited<ReturnType<FilingsCollectorService['listDownloadedReports']>>['items'];
  }> {
    const page = this.readPositiveInt(query.page, 'page', 1);
    const pageSize = this.readPositiveInt(query.pageSize, 'pageSize', 50);
    const formType = this.readOptionalText(query.formType, 'formType')?.toUpperCase();
    const cik = this.readOptionalCik(query.cik, 'cik');
    const ticker = this.readOptionalTicker(query.ticker, 'ticker');
    const since = this.readOptionalDate(query.since, 'since');
    const parserStatus = this.readOptionalTextAllowEmpty(query.parserStatus);

    const result = await this.filingsCollectorService.listDownloadedReports({
      page,
      pageSize,
      formType,
      cik,
      ticker,
      since,
      parserStatus,
    });

    return {
      filters: { page, pageSize, formType, cik, ticker, since, parserStatus },
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
      },
      items: result.items,
    };
  }

  @ApiOperation({
    summary: '공시 parser 상태 업데이트',
    description: '특정 filing의 parser_status 값을 갱신합니다.',
  })
  @ApiBody({ type: FilingParserStatusUpdateBodyDto })
  @ApiOkResponse({ type: FilingParserStatusUpdateResponseDto })
  @ApiBadRequestResponse({ description: 'accessionNo, cik, parserStatus 형식이 올바르지 않으면 반환됩니다.' })
  @Post('filings/parser-status')
  async updateFilingParserStatus(
    @Body() rawBody?: unknown,
    @Headers(REQUEST_ID_HEADER) requestId?: string,
  ): Promise<{
    job: 'filings:parser-status-updated';
    correlationId: string;
    requestedAt: string;
    accessionNo: string;
    cik: string;
    parserStatus: string;
  }> {
    const body = this.readBody(rawBody);
    const accessionNo = this.readRequiredAccessionNo(body.accessionNo, 'accessionNo');
    const cik = this.readRequiredCik(body.cik, 'cik');
    const parserStatus = this.readOptionalText(body.parserStatus, 'parserStatus') ?? '';
    const correlationId = this.readCorrelationId(requestId);

    const filing = await this.filingsCollectorService.updateParserStatus({
      accessionNo,
      cik,
      parserStatus,
      correlationId,
    });

    return {
      job: 'filings:parser-status-updated',
      correlationId,
      requestedAt: new Date().toISOString(),
      accessionNo: filing.accessionNo,
      cik: filing.cik,
      parserStatus: filing.parserStatus,
    };
  }

  private readCorrelationId(requestId: string | undefined): string {
    const trimmed = requestId?.trim();
    return trimmed || `collector-job-${Date.now().toString(36)}`;
  }

  private readBody(rawBody: unknown): RawBody {
    if (rawBody === undefined || rawBody === null) {
      return {};
    }

    if (typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      throw new BadRequestException('Request body must be a JSON object.');
    }

    return rawBody as RawBody;
  }

  private readPositiveInt(raw: unknown, fieldName: string, fallback: number): number {
    const value = this.firstValue(raw);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException(`${fieldName} must be a positive integer.`);
    }

    return parsed;
  }

  private readNonNegativeInt(raw: unknown, fieldName: string, fallback: number): number {
    const value = this.firstValue(raw);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(`${fieldName} must be zero or a positive integer.`);
    }

    return parsed;
  }

  private readOptionalDate(raw: unknown, fieldName: string): string | undefined {
    const value = this.firstValue(raw);
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a date string in YYYY-MM-DD format.`);
    }

    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new BadRequestException(`${fieldName} must match YYYY-MM-DD.`);
    }

    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} is not a valid date.`);
    }

    return trimmed;
  }

  private readOptionalStatus(raw: unknown, fieldName: string): FilingStatus | undefined {
    const value = this.firstValue(raw);
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const normalized = String(value).trim().toLowerCase() as FilingStatus;
    if (!VALID_STATUSES.includes(normalized)) {
      throw new BadRequestException(
        `${fieldName} must be one of: ${VALID_STATUSES.join(', ')}.`,
      );
    }

    return normalized;
  }

  private readRequiredCik(raw: unknown, fieldName: string): string {
    const cik = this.readOptionalCik(raw, fieldName);
    if (!cik) {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    return cik;
  }

  private readRequiredAccessionNo(raw: unknown, fieldName: string): string {
    const value = this.firstValue(raw);
    if (value === undefined || value === null) {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    const trimmed = String(value).trim();
    if (!trimmed) {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    if (!/^[A-Za-z0-9-]{1,32}$/.test(trimmed)) {
      throw new BadRequestException(`${fieldName} must be 1 to 32 chars and use only A-Z, a-z, 0-9, hyphen(-).`);
    }

    return trimmed;
  }

  private readOptionalCik(raw: unknown, fieldName: string): string | undefined {
    const value = this.firstValue(raw);
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const trimmed = String(value).trim();
    if (!/^\d{1,10}$/.test(trimmed)) {
      throw new BadRequestException(`${fieldName} must contain 1 to 10 digits.`);
    }

    return trimmed.padStart(10, '0');
  }

  private readOptionalTicker(raw: unknown, fieldName: string): string | undefined {
    const value = this.firstValue(raw);
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const trimmed = String(value).trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,32}$/.test(trimmed)) {
      throw new BadRequestException(
        `${fieldName} must be 1 to 32 chars and use only A-Z, 0-9, dot(.), hyphen(-).`,
      );
    }

    return trimmed;
  }

  private readOptionalText(raw: unknown, _fieldName: string): string | undefined {
    const value = this.firstValue(raw);
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private readOptionalTextAllowEmpty(raw: unknown): string | undefined {
    const value = this.firstValue(raw);
    if (value === undefined || value === null) {
      return undefined;
    }

    return String(value).trim();
  }

  private readOptionalCikList(raw: unknown, fieldName: string): string[] | undefined {
    if (raw === undefined || raw === null || raw === '') {
      return undefined;
    }

    const values = Array.isArray(raw) ? raw : String(raw).split(',');
    if (values.length === 0) {
      return undefined;
    }

    const ciks = Array.from(
      new Set(
        values
          .map((item) => this.readOptionalCik(item, fieldName))
          .filter((item): item is string => Boolean(item)),
      ),
    );

    return ciks.length > 0 ? ciks : undefined;
  }

  private readOptionalTickerList(raw: unknown, fieldName: string): string[] | undefined {
    if (raw === undefined || raw === null || raw === '') {
      return undefined;
    }

    const values = Array.isArray(raw) ? raw : String(raw).split(',');
    if (values.length === 0) {
      return undefined;
    }

    const tickers = Array.from(
      new Set(
        values
          .map((item) => this.readOptionalTicker(item, fieldName))
          .filter((item): item is string => Boolean(item)),
      ),
    );

    return tickers.length > 0 ? tickers : undefined;
  }

  private readOptionalBoolean(
    raw: unknown,
    fieldName: string,
    fallback: boolean,
  ): boolean {
    const value = this.firstValue(raw);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    if (value === true || value === 'true') {
      return true;
    }
    if (value === false || value === 'false') {
      return false;
    }
    throw new BadRequestException(`${fieldName} must be a boolean.`);
  }

  private firstValue(raw: unknown): unknown {
    return Array.isArray(raw) ? raw[0] : raw;
  }
}
