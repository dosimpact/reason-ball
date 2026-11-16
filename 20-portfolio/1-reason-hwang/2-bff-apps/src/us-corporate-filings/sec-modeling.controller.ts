import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SecModelingService, filingIdentity, pageNumber, pageLimit, modelingFilters, stageNumber } from './service/sec-modeling.service';

@ApiTags('SEC Modeling')
@Controller('modeling')
export class SecModelingController {
  constructor(private readonly modeling: SecModelingService) {}
  @Get('filings')
  filings(@Query() query: Record<string, string>) {
    const filters = modelingFilters(query);
    return this.modeling.filings(pageLimit(query.limit, 20), pageNumber(query.offset, 0, 1000000), filters.cik, filters);
  }
  @Get('overview')
  overview(@Query() query: Record<string, string>) {
    return this.modeling.store.overview(modelingFilters(query));
  }
  @Post('filings/:cik/:accessionNo/model-:stage/runs')
  @HttpCode(202)
  create(@Param('cik') cik: string, @Param('accessionNo') accession: string, @Param('stage') stage: string, @Body() body: any) {
    return this.modeling.create(cik, accession, stageNumber(stage), body);
  }
  @Get('runs')
  runs(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('cik') cik?: string, @Query('accessionNo') accession?: string) {
    return this.modeling.store.runs(pageLimit(limit, 50), pageNumber(offset, 0, 1000000), cik?.padStart(10, '0'), accession);
  }
  @Get('runs/:runId')
  async run(@Param('runId', new ParseUUIDPipe()) id: string) {
    const run = await this.modeling.store.run(id);
    const { items: workUnits, total: workUnitsTotal } = await this.modeling.store.units(id);
    return { ...run, workUnits, workUnitsTotal, workUnitsTruncated: workUnitsTotal > workUnits.length };
  }
  @Get('runs/:runId/events')
  events(@Param('runId', new ParseUUIDPipe()) id: string, @Query('cursor') cursor = '0') {
    if (!/^\d{1,18}$/.test(cursor)) throw new BadRequestException('Invalid event cursor');
    return this.modeling.store.events(id, cursor);
  }
  @Post('runs/:runId/cancel')
  @HttpCode(200)
  cancel(@Param('runId', new ParseUUIDPipe()) id: string) { return this.modeling.store.cancel(id); }
  @Post('runs/:runId/retry')
  @HttpCode(202)
  retry(@Param('runId', new ParseUUIDPipe()) id: string) { return this.modeling.retry(id); }
  @Get('filings/:cik/:accessionNo/status')
  status(@Param('cik') cik: string, @Param('accessionNo') accession: string) {
    [cik, accession] = filingIdentity(cik, accession);
    return this.modeling.client.request(`/internal/sec-modeling/filings/${cik}/${accession}/status`);
  }
  @Get('filings/:cik/:accessionNo/results/:stage')
  results(@Param('cik') cik: string, @Param('accessionNo') accession: string, @Param('stage') stage: string,
    @Query('limit') limit?: string, @Query('offset') offset?: string) {
    [cik, accession] = filingIdentity(cik, accession);
    return this.modeling.client.request(`/internal/sec-modeling/filings/${cik}/${accession}/results/${stageNumber(stage)}?limit=${pageLimit(limit, 50)}&offset=${pageNumber(offset, 0, 1000000)}`);
  }
  @Post('search')
  @HttpCode(200)
  search(@Body() body: any) { return this.modeling.client.request('/api/sec-analysis/search', body); }
  @Post('facts/query')
  @HttpCode(200)
  facts(@Body() body: any) { return this.modeling.client.request('/api/sec-analysis/facts/query', body); }
  @Get('evidence/:id')
  evidence(@Param('id') id: string) { return this.modeling.client.request(`/api/sec-analysis/evidence/${encodeURIComponent(id)}`); }
}
