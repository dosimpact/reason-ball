const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
require('reflect-metadata');
const { documentFromBytes } = require('../dist/lib/sec/sec.utils');
const { SecClientService } = require('../dist/lib/sec/sec.client');
const { FilingService } = require('../dist/us-corporate-filings/service/filing.service');
const { FilingBackfillService } = require('../dist/us-corporate-filings/service/filing-backfill.service');

test('UTF-8 bytes, BOM, checksum and size are preserved', () => {
  const bytes = Buffer.from('\ufeff<html>보고서</html>');
  const value = documentFromBytes(bytes, 'text/html');
  assert.deepEqual(Buffer.from(value.documentContent), bytes);
  assert.equal(value.documentSizeBytes, String(bytes.length));
  assert.equal(value.checksum, createHash('sha256').update(bytes).digest('hex'));
});

test('empty, invalid UTF-8 and NUL are rejected before persistence', () => {
  for (const bytes of [Buffer.alloc(0), Buffer.from([0xff]), Buffer.from('a\0b')]) {
    assert.throws(() => documentFromBytes(bytes, null));
  }
});

test('bounded download validates declared and actual stream sizes', async () => {
  const client = new SecClientService({ secDocumentMaxBytes: 4 });
  client.request = async () => new Response('1234');
  assert.equal((await client.downloadDocument('unused')).documentContent, '1234');
  client.request = async () => new Response('1', { headers: { 'content-length': '5' } });
  await assert.rejects(client.downloadDocument('unused'), /TOO_LARGE/);
  client.request = async () => new Response('12345');
  await assert.rejects(client.downloadDocument('unused'), /TOO_LARGE/);
});

function collectorHarness(client, failWrite = false) {
  const row = { accessionNo: 'test', cik: '0000000001', primaryDoc: 'report.htm', filingUrl: 'unused', status: 'pending', retryCount: 0 };
  const writes = [];
  const repository = {
    async update(criteria, values) {
      writes.push(values);
      if (failWrite) throw new Error('database write failed');
      if (row.status === criteria.status) Object.assign(row, values);
    },
    async findOneByOrFail() { return row; },
    createQueryBuilder() {
      return { update() { return this; }, set(v) { this.values = v; return this; },
        where() { return this; }, async execute() {
          if (row.status === 'pending') Object.assign(row, { status: this.values.status, errorMessage: this.values.errorMessage, retryCount: row.retryCount + 1 });
        } };
    },
  };
  return { row, writes, service: new FilingBackfillService({}, {}, client, repository, {}) };
}

test('successful download atomically stores content, checksum, size and status without path', async () => {
  const h = collectorHarness({ downloadDocument: async () => documentFromBytes(Buffer.from('<html/>'), 'text/html') });
  assert.equal(await h.service.downloadSingleFiling(h.row), 'downloaded');
  assert.equal(h.writes.length, 1);
  assert.equal(h.row.filePath, null);
  assert.equal(h.row.documentContent, '<html/>');
  assert.ok(h.row.documentDownloadedAt instanceof Date);
});

test('HTTP failure records failure without content', async () => {
  const h = collectorHarness({ downloadDocument: async () => { throw new Error('HTTP failed'); } });
  assert.equal(await h.service.downloadSingleFiling(h.row), 'failed');
  assert.equal(h.row.retryCount, 1);
  assert.equal(h.row.documentContent, undefined);
});

test('DB write failure cannot leave a downloaded state', async () => {
  const h = collectorHarness({ downloadDocument: async () => documentFromBytes(Buffer.from('body'), null) }, true);
  assert.equal(await h.service.downloadSingleFiling(h.row), 'failed');
  assert.equal(h.row.documentContent, undefined);
});

test('late failed worker cannot overwrite a committed success', async () => {
  const h = collectorHarness({ downloadDocument: async () => {
    Object.assign(h.row, { status: 'downloaded', documentContent: 'winner' });
    throw new Error('late failure');
  } });
  assert.equal(await h.service.downloadSingleFiling(h.row), 'downloaded');
  assert.equal(h.row.documentContent, 'winner');
  assert.equal(h.row.retryCount, 0);
});

test('historical filing without primary document downloads the full-submission URL', async () => {
  const h = collectorHarness({ downloadDocument: async url => { assert.equal(url, 'full.txt'); return documentFromBytes(Buffer.from('historical filing'), 'text/plain'); } });
  h.row.primaryDoc = null; h.row.filingUrl = 'full.txt';
  assert.equal(await h.service.downloadSingleFiling(h.row), 'downloaded');
});

test('late successful worker also preserves the first committed body', async () => {
  const h = collectorHarness({ downloadDocument: async () => {
    Object.assign(h.row, { status: 'downloaded', documentContent: 'winner' });
    return documentFromBytes(Buffer.from('late body'), 'text/html');
  } });
  assert.equal(await h.service.downloadSingleFiling(h.row), 'downloaded');
  assert.equal(h.row.documentContent, 'winner');
});

test('report page budget rejects oversized responses before loading bodies', async () => {
  const query = new Proxy({}, { get(_target, key) {
    if (key === 'getCount') return async () => 1;
    if (key === 'getMany') return async () => [{cik:'1',accessionNo:'one',formType:'10-K',reportDate:null,documentSizeBytes:String(65*1024*1024)}];
    if (key === 'addSelect') return () => assert.fail('must reject before loading content');
    return () => query;
  }});
  const service = new FilingService({ createQueryBuilder: () => query });
  await assert.rejects(service.listFilings({page:1,pageSize:50,includeContent:true,includeAmendments:false}), error => error.getStatus() === 413);
});

const { linkAmendments } = require('../dist/us-corporate-filings/service/filing.service');
test('amendments link to a unique original without replacing its content', () => {
  const original = {cik:'1', accessionNo:'o', formType:'10-K', reportDate:'2025-12-31', filingDate:'2026-02-01'};
  const amendment = {...original, accessionNo:'a', formType:'10-K/A', filingDate:'2026-03-01'};
  assert.equal(linkAmendments(amendment,[original,amendment]).original, original);
  assert.deepEqual(linkAmendments(original,[original,amendment]).amendments,[amendment]);
  assert.equal(linkAmendments(amendment,[amendment]).status,'missing-original');
  assert.equal(linkAmendments(amendment,[original,{...original,accessionNo:'o2'},amendment]).status,'ambiguous-original');
  assert.equal(linkAmendments({...amendment,reportDate:null},[original]).status,'missing-report-date');
  assert.equal(linkAmendments(amendment,[{...original,cik:'2'},amendment]).status,'missing-original');
  assert.equal(linkAmendments(amendment,[{...original,formType:'10-Q'},amendment]).status,'missing-original');
});

test('nested original and amendment bodies count toward the response budget', async () => {
  const original = {cik:'1',accessionNo:'o',formType:'10-K',reportDate:'2025-12-31',filingDate:'2026-02-01',documentSizeBytes:String(25*1024*1024)};
  const amendment = {...original,accessionNo:'a',formType:'10-K/A',filingDate:'2026-03-01'};
  const query = new Proxy({}, {get(_t,k) {
    if(k==='getCount') return async()=>1;
    if(k==='getMany') return async()=>[amendment];
    if(k==='addSelect') return ()=>assert.fail('must reject before loading bodies');
    return ()=>query;
  }});
  const service = new FilingService({createQueryBuilder:()=>query,find:async()=>[original,amendment]});
  await assert.rejects(service.listFilings({page:1,pageSize:1,includeContent:true,includeAmendments:true}),e=>e.getStatus()===413);
});
