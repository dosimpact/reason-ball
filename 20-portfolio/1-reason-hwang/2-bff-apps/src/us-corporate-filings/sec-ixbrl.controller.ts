import { BadRequestException, Controller, Get, Header, Inject, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { FilingContentParamsPipe, FilingContentParams } from './entity/filing.dto';
import { SecIxbrlService } from './service/sec-ixbrl.service';

function queryInput(raw: Record<string, unknown>, view: 'metadata' | 'facts' | 'document') {
  const allowed = view === 'metadata' ? [] : view === 'document' ? ['sourceHash'] : ['sourceHash', 'q', 'page', 'factId'];
  for (const [key, value] of Object.entries(raw)) if (!allowed.includes(key) || typeof value !== 'string') throw new BadRequestException('Invalid SEC iXBRL query');
  const input = raw as Record<string, string>;
  if (view !== 'metadata' && !/^[a-f0-9]{64}$/.test(input.sourceHash ?? '')) throw new BadRequestException('sourceHash is required; load metadata first');
  if (input.q && (input.q.length > 200 || input.factId)) throw new BadRequestException('q must be at most 200 characters and cannot be combined with factId');
  if (input.factId !== undefined && !/^ix-fact-[1-9]\d{0,5}$/.test(input.factId)) throw new BadRequestException('Invalid factId');
  if (input.page !== undefined && (!/^\d+$/.test(input.page) || Number(input.page) < 1 || Number(input.page) > 100000)) throw new BadRequestException('Invalid page');
  return input;
}

@ApiTags('SEC iXBRL Viewer')
@Controller('filings/:cik/:accessionNo/ixbrl')
export class SecIxbrlController {
  constructor(@Inject(SecIxbrlService) private readonly viewer: SecIxbrlService) { }

  @Get()
  @Header('Cache-Control', 'no-store')
  metadata(@Param(FilingContentParamsPipe) id: FilingContentParams, @Query() raw: Record<string, unknown>) {
    queryInput(raw, 'metadata');
    return this.viewer.inspect(id.cik, id.accessionNo, 'metadata');
  }

  @Get('facts')
  @Header('Cache-Control', 'no-store')
  facts(@Param(FilingContentParamsPipe) id: FilingContentParams, @Query() raw: Record<string, unknown>) {
    const { sourceHash, ...query } = queryInput(raw, 'facts');
    return this.viewer.inspect(id.cik, id.accessionNo, 'facts', sourceHash, query);
  }

  @Get('document')
  async document(@Param(FilingContentParamsPipe) id: FilingContentParams, @Query() raw: Record<string, unknown>, @Res() response: Response) {
    const { sourceHash } = queryInput(raw, 'document');
    const result = await this.viewer.inspect(id.cik, id.accessionNo, 'document', sourceHash);
    response.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'X-Source-Hash': result.sourceHash, 'X-Extractor-Version': result.extractorVersion,
      'Content-Security-Policy': "sandbox; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    }).send(result.html);
  }
}
