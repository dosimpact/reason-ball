const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
require('reflect-metadata');
const { documentFromBytes } = require('../dist/sec/common/sec/document-content');
const { SecClientService } = require('../dist/sec/common/sec/sec-client.service');
const { FilingsCollectorService } = require('../dist/sec/filings-collector/filings-collector.service');

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
  return { row, writes, service: new FilingsCollectorService({}, repository, client, {}) };
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

test('missing primary document is failed without requesting SEC', async () => {
  const h = collectorHarness({ downloadDocument: async () => assert.fail('must not download') });
  h.row.primaryDoc = null;
  assert.equal(await h.service.downloadSingleFiling(h.row), 'failed');
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
  let selections = [];
  const query = new Proxy({}, { get(_target, key) {
    if (key === 'getCount') return async () => 1;
    if (key === 'select') return value => { selections.push(value); return query; };
    if (key === 'getRawMany') return async () => [{ bytes: String(65 * 1024 * 1024) }];
    return () => query;
  } });
  const service = new FilingsCollectorService({}, { createQueryBuilder: () => query }, {}, {});
  await assert.rejects(service.listDownloadedReports(), error => error.getStatus() === 413);
  assert.deepEqual(selections, ['filing.document_size_bytes']);
});
