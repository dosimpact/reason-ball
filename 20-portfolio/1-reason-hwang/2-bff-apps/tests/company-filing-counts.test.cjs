const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CompanyService } = require('../dist/us-corporate-filings/service/company.service');

function fixture(items, aggregates = [], total = items.length) {
  const calls = [];
  const query = {};
  for (const method of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take']) query[method] = () => query;
  query.getManyAndCount = async () => [items, total];
  const repository = { createQueryBuilder: () => query, manager: { query: async (sql, args) => { calls.push({ sql, args }); if (aggregates instanceof Error) throw aggregates; return aggregates; } } };
  return { service: new CompanyService(repository, {}), calls };
}

test('company page counts all forms by CIK, preserves amended forms and zero-count companies', async () => {
  const { service, calls } = fixture([{ cik: '0000000001', ticker: 'A' }, { cik: '0000000002', ticker: 'B' }], [
    { cik: '0000000001', formType: '10-K', count: '3' },
    { cik: '0000000001', formType: '10-K/A', count: '1' },
    { cik: '0000000001', formType: '20-F', count: '2' },
  ], 9);
  const result = await service.listCompanies({ page: 2, pageSize: 2 });
  assert.deepEqual(result.items[0].filingCounts, { total: 6, byFormType: [{ formType: '10-K', count: 3 }, { formType: '10-K/A', count: 1 }, { formType: '20-F', count: 2 }] });
  assert.deepEqual(result.items[1].filingCounts, { total: 0, byFormType: [] });
  assert.deepEqual(result.pagination, { page: 2, pageSize: 2, totalItems: 9, totalPages: 5, hasNextPage: true });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, [['0000000001', '0000000002']]);
  assert.doesNotMatch(calls[0].sql, /document_content|filing_date/i);
});

test('empty page does not run a filing aggregate or lose pagination totals', async () => {
  const { service, calls } = fixture([], [], 4);
  const result = await service.listCompanies({ page: 9, pageSize: 1 });
  assert.deepEqual(result.items, []);
  assert.equal(result.pagination.totalItems, 4);
  assert.equal(calls.length, 0);
});

test('aggregate failures are not silently reported as zero stored filings', async () => {
  const { service } = fixture([{ cik: '0000000001', ticker: 'A' }], new Error('aggregate unavailable'));
  await assert.rejects(service.listCompanies(), /aggregate unavailable/);
});
