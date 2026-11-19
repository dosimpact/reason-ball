import { Controller, Get, Header, Inject, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DartClient, type DartEndpoint } from '../lib/dart/dart.client';
import { validateDartQuery } from './open-dart.dto';

@ApiTags('Open DART')
@Controller('api/dart')
export class OpenDartController {
  constructor(@Inject(DartClient) private readonly client: DartClient) { }

  @Get('corpCode.xml')
  @ApiOperation({ summary: 'Open DART 고유번호 ZIP (서버 인증키 사용)' })
  @ApiProduces('application/zip')
  corpCodes(@Query() query: Record<string, unknown>, @Res() response: Response) { return this.download('corpCode.xml', query, response, 'dart-corp-codes.zip'); }

  @Get('document.xml')
  @ApiOperation({ summary: 'Open DART 공시 원문 ZIP' })
  @ApiProduces('application/zip')
  document(@Query() query: Record<string, unknown>, @Res() response: Response) {
    const input = validateDartQuery('document.xml', query);
    return this.download('document.xml', input, response, `dart-document-${input.rcept_no}.zip`);
  }

  @Get('list.json')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Open DART 공시 검색' })
  list(@Query() query: Record<string, unknown>) { return this.json('list.json', query); }

  @Get('company.json')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Open DART 기업개황' })
  company(@Query() query: Record<string, unknown>) { return this.json('company.json', query); }

  @Get('fnlttSinglAcntAll.json')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Open DART 단일회사 전체 재무제표' })
  financialStatements(@Query() query: Record<string, unknown>) { return this.json('fnlttSinglAcntAll.json', query); }

  private async json(endpoint: DartEndpoint, query: Record<string, unknown>) {
    return this.client.request(endpoint, validateDartQuery(endpoint, query), false);
  }

  private async download(endpoint: DartEndpoint, query: Record<string, unknown>, response: Response, filename: string) {
    const bytes = await this.client.request(endpoint, validateDartQuery(endpoint, query), true);
    response.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${filename}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Length': String(bytes.length) }).send(bytes);
  }
}
