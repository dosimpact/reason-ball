import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

// Owned browser-validation upstream. It never connects to SEC or a database.
const companies = [
  { cik: '0000320193', ticker: 'AAPL', name: 'Apple Inc.', sic: 3571, updatedAt: '2026-11-14T00:00:00Z' },
  { cik: '0000789019', ticker: 'MSFT', name: 'Microsoft Corporation', sic: 7372, updatedAt: '2026-11-14T00:00:00Z' },
];
const makeFiling = (accessionNo, formType, status, cik = companies[0].cik) => ({ cik, accessionNo, ticker: cik === companies[0].cik ? 'AAPL' : 'MSFT', companyName: cik === companies[0].cik ? 'Apple Inc.' : 'Microsoft Corporation', formType, status, filingDate: '2026-10-30', reportDate: '2026-09-26', primaryDoc: 'annual.htm', filingUrl: 'https://www.sec.gov/Archives/example.htm', parserStatus: '', errorMessage: status === 'failed' ? 'Fixture download failure' : null, retryCount: 0, checksum: status === 'downloaded' ? 'a'.repeat(64) : null, documentSizeBytes: status === 'downloaded' ? '100' : null, updatedAt: '2026-11-14T00:00:00Z', content: null, original: null, amendments: [], amendmentLinkStatus: 'not-amendment', amendmentLinkBasis: null });
const original = makeFiling('0000320193-26-000100', '10-K', 'downloaded');
const amendment = makeFiling('0000320193-26-000101', '10-K/A', 'downloaded');
amendment.original = { ...original };
amendment.amendmentLinkStatus = 'linked';
original.amendments = [{ ...amendment, original: null }];
const filings = [original, amendment, makeFiling('0000320193-26-000102', '10-Q', 'pending'), makeFiling('0000320193-26-000103', '8-K', 'failed'), makeFiling('0000789019-26-000100', '10-K', 'downloaded', companies[1].cik)];
for (let index = 0; index < 10; index += 1) companies.push({ cik: String(1000000 + index).padStart(10, '0'), ticker: `TEST${index}`, name: `Fixture Company ${index}`, sic: null, updatedAt: '2026-11-14T00:00:00Z' });
for (let index = 0; index < 10; index += 1) filings.push(makeFiling(`0000320193-26-0002${String(index).padStart(2, '0')}`, '10-Q', 'downloaded'));
const calls = [];
const json = (response, body, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
const pageOf = (items, search) => { const page = Number(search.get('page') || 1); const pageSize = Number(search.get('pageSize') || 50); return { filters: Object.fromEntries(search), items: items.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, totalItems: items.length, totalPages: Math.ceil(items.length / pageSize), hasNextPage: page * pageSize < items.length } }; };
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://fixture');
  let body = '';
  for await (const chunk of request) body += chunk;
  calls.push({ method: request.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: body ? JSON.parse(body) : null });
  if (url.pathname === '/__calls') return json(response, calls);
  if (url.pathname === '/api/sec/companies') {
    if (url.searchParams.get('q') === 'SLOW') await delay(5000);
    if (url.searchParams.get('q') === 'TEXTERROR') { response.writeHead(502, { 'Content-Type': 'text/plain', 'X-Fixture': 'plain-error' }); return response.end('Fixture non-JSON upstream error'); }
    if (url.searchParams.has('page') && Number(url.searchParams.get('page')) < 1) return json(response, { statusCode: 400, message: ['page must be positive'], error: 'Bad Request' }, 400);
    const q = (url.searchParams.get('q') || url.searchParams.get('ticker') || '').toLowerCase();
    if (q === 'error') return json(response, { message: 'Fixture company failure' }, 503);
    return json(response, pageOf(companies.filter(company => `${company.name} ${company.ticker}`.toLowerCase().includes(q)), url.searchParams));
  }
  if (url.pathname.endsWith('/content')) {
    if (url.pathname.includes('000102') || url.pathname.includes('000103')) return json(response, { message: 'Document unavailable' }, 409);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "sandbox; default-src 'none'", 'X-Content-Type-Options': 'nosniff' });
    return response.end('<!doctype html><h1>Fixture annual filing</h1><p>Stored original document.</p><script>window.__secRawExecuted=true</script>');
  }
  if (url.pathname === '/api/sec/filings') {
    const items = filings.filter(filing => ['cik','ticker','status','formType','parserStatus'].every(key => !url.searchParams.has(key) || filing[key] === url.searchParams.get(key)));
    return json(response, pageOf(items, url.searchParams));
  }
  if (url.pathname === '/api/sec/company-sync-jobs') return json(response, { job: 'company-sync', syncedCount: 2, requestedAt: new Date().toISOString(), correlationId: 'fixture-sync' }, 201);
  if (url.pathname.endsWith('company-filing-sync-jobs')) {
    const input = JSON.parse(body || '{}');
    if (!input || typeof input !== 'object' || Array.isArray(input)) return json(response, { statusCode: 400, message: 'Request body must be an object', error: 'Bad Request' }, 400);
    if (typeof input.years === 'string' || Number(input.years ?? 20) < 1 || Number(input.years ?? 20) > 30) return json(response, { statusCode: 400, message: 'years must be an integer between 1 and 30.', error: 'Bad Request' }, 400);
    if (url.pathname === '/api/sec/company-filing-sync-jobs' && !input.ciks?.length && !input.tickers?.length) return json(response, { statusCode: 400, message: 'Specify ciks or tickers.', error: 'Bad Request' }, 400);
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    let closed = false;
    response.on('close', () => { closed = true; });
    const event = async (name, data) => {
      const text = `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
      // Split field names, JSON, delimiters and Korean UTF-8 across reads.
      const bytes = Buffer.from(text);
      for (let i = 0; i < bytes.length; i += 13) { if (closed) return; response.write(bytes.subarray(i, i + 13)); await delay(2); }
    };
    await event('started', { startedAt: new Date().toISOString() });
    await delay(500);
    if ((input.tickers || []).includes('ERROR')) { await event('error', { message: 'Fixture upstream failure', statusCode: 502 }); return response.end(); }
    await event('progress', { phase: 'metadata', message: '메타데이터 수집', filingsSynced: 4, tickerOnly: true, totalCompanies: 2 });
    response.write(': heartbeat\n\n');
    await delay((input.tickers || []).includes('SLOW') ? 5000 : 500);
    if ((input.tickers || []).includes('INCOMPLETE')) return response.end();
    await event('progress', { phase: 'documents', downloaded: input.downloadDocuments ? 3 : 0, failed: 0, skipped: !input.downloadDocuments });
    await event('completed', { companiesProcessed: 1, filingsSynced: 4, downloaded: input.downloadDocuments ? 3 : 0, failed: (input.tickers || []).includes('PARTIAL') ? 1 : 0, tickerOnly: true, totalCompanies: 2 });
    return response.end();
  }
  return json(response, { message: 'Fixture route missing' }, 404);
});
server.listen(Number(process.env.FIXTURE_PORT || 3980), '127.0.0.1', () => process.stdout.write(`SEC fixture ready ${server.address().port}\n`));
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
