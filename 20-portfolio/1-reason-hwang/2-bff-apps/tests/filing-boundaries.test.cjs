const { test } = require('node:test');
const assert = require('node:assert/strict');
const f = require('../dist/lib/sec/sec.utils');
const pipes = {...require('../dist/us-corporate-filings/entity/filing.dto'), ...require('../dist/us-corporate-filings/entity/company.dto')};
const { MAX_COMPANY_PAGE_SIZE } = require('../dist/us-corporate-filings/entity/company.dto');
const { parseBulkSubmission } = require('../dist/lib/sec/sec.archive');
const { readEnvironment } = require('../dist/shared/config.service');
const { AppConfigService } = require('../dist/shared/config.service');

test('SEC identifiers and dates normalize consistently', () => {
  assert.equal(f.tryNormalizeCik('320193'), '0000320193');
  assert.equal(f.tryNormalizeTicker(' aapl '), 'AAPL');
  assert.equal(f.tryNormalizeCik('bad'), undefined);
  assert.equal(f.hasDateValue('2025-99-01'), false);
});

test('request pipes preserve HTTP normalization, defaults and compatibility coercion', () => {
  const query = new pipes.CompaniesQueryPipe().transform({ page: '2', limit: '1', pageSize: '100001', cik: '1', ticker: 'aaa' });
  assert.equal(query.pageSize, MAX_COMPANY_PAGE_SIZE);
  assert.equal(query.cik, '0000000001');
  assert.equal(query.ticker, 'AAA');
  const body = new pipes.SelectedBackfillPipe().transform({ ciks: '1,0000000001,2', tickers: ['aapl',' AAPL '], pageSize: '2x' });
  assert.deepEqual(body.ciks, ['0000000001','0000000002']);
  assert.deepEqual(body.tickers, ['AAPL']);
  assert.equal(new pipes.FilingsQueryPipe().transform({ parserStatus: '' }).parserStatus, '');
  assert.deepEqual(new pipes.BackfillBodyPipe().transform(undefined), { years: 20, refreshArchive: false, downloadDocuments: true });
});

test('request pipes reject malformed HTTP inputs before business work', () => {
  for (const [Pipe, value] of [
    [pipes.CompaniesQueryPipe, { page: '1.5' }],
    [pipes.CompaniesQueryPipe, { page: ['1', '2'] }],
    [pipes.SelectedBackfillPipe, []],
    [pipes.SelectedBackfillPipe, { cik: 'unused', ciks: ['bad'] }],
    [pipes.SelectedBackfillPipe, { since: 2025 }],
    [pipes.FilingsQueryPipe, { status: 'other' }],
    [pipes.BackfillBodyPipe, { years: 31 }],
    [pipes.BackfillBodyPipe, { refreshArchive: 'yes' }],
    [pipes.SelectedBackfillPipe, {}],
  ]) assert.throws(() => new Pipe().transform(value), error => error.getStatus() === 400);
});

test('bulk transformation filters scope and preserves metadata and URL encoding', () => {
  const rows = parseBulkSubmission('0000000001', {
    name: ' Company ', tickers: ['aaa'], sic: '3571',
    filings: { recent: {
      accessionNumber: ['a-1', 'a-2', 'a-3', 'a-4'],
      form: ['10-K','10-Q','4','8-K'],
      filingDate: ['2026-01-01','2020-01-01','2026-01-01','2026-01-01'],
      primaryDocument: ['report a.htm', 'old.htm', 'other.htm', null],
    } },
  }, '2025-01-01');
  assert.deepEqual(rows.companies, [{ cik: '0000000001', ticker: 'AAA', name: 'Company', sic: 3571 }]);
  assert.equal(rows.filings.length, 2);
  assert.match(rows.filings[0].filingUrl, /\/1\/a1\/report%20a.htm$/);
  assert.match(rows.filings[1].filingUrl, /\/1\/a4\/a-4.txt$/);
});

test('configuration validates once with safe errors and documented defaults', () => {
  const defaults = readEnvironment({}, '/tmp/test-config');
  assert.equal(defaults.appPort, 2801);
  assert.equal(defaults.secRetryCount, 3);
  assert.equal(readEnvironment({ PORT: '0', APP_PORT: '1234' }).appPort, 0);
  assert.equal(readEnvironment({ APP_PORT: '1234' }).appPort, 1234);
  for (const env of [
    { POSTGRES_PORT: 'bad' }, { PORT: '70000' }, { SEC_RETRY_COUNT: '-1' },
    { SEC_DOCUMENT_MAX_BYTES: '0' },
    { SEC_RATE_LIMIT_RPS: '1x' }, { SWAGGER_ENABLED: 'yes' },
    { SEC_BULK_SUBMISSIONS_URL: 'file:///secret' },
  ]) assert.throws(() => readEnvironment(env));
  assert.throws(() => readEnvironment({ DATABASE_URL: 'secret-password' }), error => !error.message.includes('secret-password'));
  const old = process.env.SEC_RATE_LIMIT_RPS;
  try {
    process.env.SEC_RATE_LIMIT_RPS = '2.5';
    const service = new AppConfigService();
    process.env.SEC_RATE_LIMIT_RPS = 'bad';
    assert.equal(service.secRateLimitRps, 2.5);
    assert.throws(() => new AppConfigService(), /SEC_RATE_LIMIT_RPS/);
  } finally {
    if (old === undefined) delete process.env.SEC_RATE_LIMIT_RPS;
    else process.env.SEC_RATE_LIMIT_RPS = old;
  }
});
