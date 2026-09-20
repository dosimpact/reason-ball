// Explicitly opt-in: writes one real Apple 10-K into the configured database.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { DataSource } = require('typeorm');
const { AppModule } = require('../dist/app.module');
const { SecClientService } = require('../dist/lib/sec/sec.client');
const { FilingBackfillService } = require('../dist/us-corporate-filings/service/filing-backfill.service');
const { Company } = require('../dist/us-corporate-filings/entity/company.entity');
const { Filing } = require('../dist/us-corporate-filings/entity/filing.entity');

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['warn', 'error'] });
  try {
    app.setGlobalPrefix('api/sec');
    await app.listen(0, '127.0.0.1'); // Own ephemeral port; always closed below.
    const db = app.get(DataSource);
    const [{ database }] = await db.query('SELECT current_database() AS database');
    assert.equal(database, 'sec_collector');
    const client = app.get(SecClientService);
    const service = app.get(FilingBackfillService);
    const data = await client.getJson('https://data.sec.gov/submissions/CIK0000320193.json');
    const recent = data.filings.recent;
    const index = recent.form.indexOf('10-K');
    assert.ok(index >= 0);
    const cik = String(data.cik).padStart(10, '0');
    const accessionNo = recent.accessionNumber[index];
    const primaryDoc = recent.primaryDocument[index];
    const filingUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNo.replaceAll('-', '')}/${primaryDoc}`;
    // Fetch the actual SEC body before changing the filing, and compare it to the API later.
    const expected = await client.downloadDocument(filingUrl);
    assert.match(expected.documentContent, /10-K/i);
    await db.getRepository(Company).upsert({ cik, name: data.name, ticker: 'AAPL' }, ['cik']);
    await db.query(`INSERT INTO filings (accession_no,cik,form_type,primary_doc,filing_url,filing_date,report_date)
      VALUES ($1,$2,'10-K',$3,$4,$5,$6) ON CONFLICT (accession_no,cik) DO NOTHING`,
      [accessionNo,cik,primaryDoc,filingUrl,recent.filingDate[index],recent.reportDate[index]]);
    const repository = db.getRepository(Filing);
    const filing = await repository.findOneByOrFail({ accessionNo, cik });
    if (filing.status === 'failed') await repository.update({ accessionNo, cik, status: 'failed' }, { status: 'pending' });
    // Exercise exactly the selected real filing, never an unrelated pending job.
    assert.equal(await service.downloadSingleFiling(filing), 'downloaded');
    const [{ contentMatches, sizeMatches, checksumMatches, noFilePath }] = await db.query(`SELECT
      document_content = $3 AS "contentMatches",
      document_size_bytes = octet_length(document_content) AS "sizeMatches",
      checksum = encode(sha256(convert_to(document_content,'UTF8')),'hex') AS "checksumMatches",
      file_path IS NULL AS "noFilePath"
      FROM filings WHERE accession_no=$1 AND cik=$2`, [accessionNo,cik,expected.documentContent]);
    assert.deepEqual([contentMatches,sizeMatches,checksumMatches,noFilePath], [true,true,true,true]);
    const response = await fetch(`${await app.getUrl()}/api/sec/filings?includeContent=true&cik=${cik}&formType=10-K&pageSize=1`);
    assert.equal(response.status, 200);
    const result = await response.json();
    const item = result.items.find(value => value.accessionNo === accessionNo);
    assert.ok(item);
    assert.equal(item.content, expected.documentContent);
    assert.equal(createHash('sha256').update(item.content).digest('hex'), expected.checksum);
    assert.equal(item.filePath, null);
    // DB itself must reject a downloaded row with no body. Roll back this test only.
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await assert.rejects(runner.query('UPDATE filings SET document_content=NULL WHERE accession_no=$1 AND cik=$2', [accessionNo,cik]), error => error.code === '23514');
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
    console.log(JSON.stringify({ result: 'PASS', database, cik, accessionNo, filingUrl,
      bytes: expected.documentSizeBytes, checksum: expected.checksum,
      apiRoundTrip: true, databaseConstraint: true, localFileRequired: false }, null, 2));
  } finally {
    await app.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
