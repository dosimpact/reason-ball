import type { Response } from 'express';
import { Body, Controller, Get, Headers, HttpCode, HttpException, Param, Res, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiNotFoundResponse, ApiParam, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CompanyService } from './service/company.service';
import { FilingService } from './service/filing.service';
import { FilingBackfillService } from './service/filing-backfill.service';
import { CompaniesQueryPipe, CompaniesQueryInput, CompaniesListResponseDto, CompanySyncJobResponseDto } from './entity/company.dto';
import { BackfillBodyDto, BackfillBodyPipe, BackfillInput, SelectedBackfillBodyDto, SelectedBackfillPipe, SelectedBackfillInput, FilingsQueryPipe, FilingsQueryInput, ReportProgress, FilingContentParamsPipe, FilingContentParams } from './entity/filing.dto';

@ApiTags('SEC Collector')
@Controller()
export class UsCorporateFilingsController {
  constructor(
    private readonly companies: CompanyService,
    private readonly filings: FilingService,
    private readonly backfill: FilingBackfillService,
  ) { }

  @Post('company-sync-jobs')
  @ApiOperation({ summary: '회사 정보 동기화' })
  @ApiCreatedResponse({ type: CompanySyncJobResponseDto })
  async createCompanySyncJob(@Headers('x-request-id') requestId?: string) {
    const correlationId = requestId?.trim() || `company-${Date.now()}`;
    return {
      job: 'companies:sync', correlationId, requestedAt: new Date().toISOString(),
      ...await this.companies.syncCompanies({ correlationId })
    };
  }

  @Get('companies')
  @ApiOperation({ summary: '회사 목록 조회', description: 'DB ticker가 비어 있지 않은 회사만 조회. 집계에도 동일 조건 적용.' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 50, description: '최대 100000' })
  @ApiQuery({ name: 'limit', required: false, description: 'pageSize 호환 별칭' })
  @ApiQuery({ name: 'cik', required: false })
  @ApiQuery({ name: 'ticker', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiOkResponse({ type: CompaniesListResponseDto })
  async listCompanies(@Query(CompaniesQueryPipe) input: CompaniesQueryInput) {
    return { filters: { ...input, limit: input.pageSize }, ...await this.companies.listCompanies(input) };
  }

  @Get('filings')
  @ApiOperation({ summary: '기업 공시 조회', description: 'DB ticker가 비어 있지 않은 회사의 공시만 조회. 원문은 includeContent=true로 포함. 원문 합계 최대 64 MiB.' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 50, description: '최대 500' })
  @ApiQuery({ name: 'limit', required: false, description: 'pageSize 호환 별칭' })
  @ApiQuery({ name: 'cik', required: false })
  @ApiQuery({ name: 'ticker', required: false })
  @ApiQuery({ name: 'since', required: false })
  @ApiQuery({ name: 'formType', required: false })
  @ApiQuery({ name: 'parserStatus', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'downloaded', 'failed'] })
  @ApiQuery({ name: 'includeAmendments', required: false, type: Boolean, description: '기본 true: 원본과 수정본을 연결. 자동 병합하지 않음.' })
  @ApiQuery({ name: 'includeContent', required: false, type: Boolean })
  listFilings(@Query(FilingsQueryPipe) input: FilingsQueryInput) {
    return this.filings.listFilings(input);
  }

  @Get('filings/:cik/:accessionNo/content')
  @ApiOperation({ summary: '공시 원문 직접 조회', description: 'DB에 저장된 단일 원문을 JSON 포장 없이 반환. 수정본 병합이나 SEC 실시간 요청 없음.' })
  @ApiParam({ name: 'cik', example: '0000320193' })
  @ApiParam({ name: 'accessionNo', example: '0000320193-25-000079' })
  @ApiProduces('text/html', 'application/xhtml+xml', 'application/xml', 'text/xml', 'text/plain')
  @ApiOkResponse({ description: '저장된 UTF-8 원문', schema: { type: 'string' } })
  @ApiBadRequestResponse({ description: '잘못된 CIK 또는 접수번호' })
  @ApiNotFoundResponse({ description: '해당 공시 없음' })
  @ApiConflictResponse({ description: '원문 다운로드 미완료' })
  async getFilingContent(@Param(FilingContentParamsPipe) input: FilingContentParams, @Res() response: Response) {
    const document = await this.filings.getContent(input.cik, input.accessionNo);
    response.set({
      'Content-Type': document.contentType,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
    }).send(document.content);
  }

  @Post('company-filing-sync-jobs')
  @ApiOperation({ summary: '특정 기업 공시 백필 (SSE)', description: '메타데이터 수집 후 원문 다운로드. downloadDocuments=false로 원문 생략.' })
  @HttpCode(200)
  @ApiBadRequestResponse({ description: '입력 검증 실패' })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: 'started → progress → completed 또는 error 이벤트 스트림' })
  @ApiBody({ type: SelectedBackfillBodyDto })
  createFilingSyncJob(@Body(SelectedBackfillPipe) input: SelectedBackfillInput, @Res() response: Response) {
    return this.streamBackfill(response, report => this.backfill.backfillCompanies(input, report));
  }

  @Post('all-company-filing-sync-jobs')
  @ApiOperation({ summary: '티커가 있는 전체 기업 공시 백필 (SSE)', description: '실행 시작 시 DB ticker가 비어 있지 않은 기업만 메타데이터·원문 수집. 회사 동기화를 먼저 실행.' })
  @HttpCode(200)
  @ApiBadRequestResponse({ description: '입력 검증 실패' })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: 'archive → metadata → documents 진행 상황과 최종 결과' })
  @ApiBody({ type: BackfillBodyDto, required: false })
  createFilingBackfillJob(@Body(BackfillBodyPipe) input: BackfillInput, @Res() response: Response) {
    return this.streamBackfill(response, report => this.backfill.backfillAll(input, report));
  }

  private async streamBackfill(response: Response, work: (report: ReportProgress) => Promise<unknown>) {
    response.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();
    const send = (event: string, data: unknown) => {
      if (response.destroyed) throw new Error('Client disconnected; rerun backfill to resume.');
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const heartbeat = setInterval(() => {
      if (!response.destroyed) response.write(': heartbeat\n\n');
    }, 15_000);
    try {
      send('started', { startedAt: new Date().toISOString() });
      const result = await work(progress => send('progress', progress));
      send('completed', result);
    } catch (error) {
      if (!response.destroyed) send('error', {
        message: error instanceof Error ? error.message : 'Backfill failed',
        statusCode: error instanceof HttpException ? error.getStatus() : 500,
      });
    } finally {
      clearInterval(heartbeat);
      response.end();
    }
  }
}
