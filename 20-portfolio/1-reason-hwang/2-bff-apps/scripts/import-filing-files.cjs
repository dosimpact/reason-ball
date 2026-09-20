// Explicit import only; preserves every source file and can be rerun safely.
const { open } = require('node:fs/promises');
const path = require('node:path');
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { DataSource } = require('typeorm');
const { SecModule } = require('../dist/sec/sec.module');
const { AppConfigService } = require('../dist/sec/common/config/app.config');
const { documentFromBytes } = require('../dist/sec/common/sec/document-content');

async function main() {
  const app = await NestFactory.createApplicationContext(SecModule, { logger: ['warn', 'error'] });
  const summary = { imported: 0, failed: 0 };
  try {
    const db = app.get(DataSource);
    const limit = app.get(AppConfigService).secDocumentMaxBytes;
    let cursor = ['', ''];
    while (true) {
      const rows = await db.query(`SELECT accession_no, cik, file_path, checksum FROM filings
        WHERE document_content IS NULL AND file_path IS NOT NULL
        AND (accession_no,cik) > ($1,$2) ORDER BY accession_no,cik LIMIT 50`, cursor);
      if (!rows.length) break;
      for (const row of rows) {
        cursor = [row.accession_no, row.cik];
        let handle;
        try {
          handle = await open(path.resolve(process.cwd(), row.file_path), 'r');
          const chunks = [];
          let size = 0;
          for await (const chunk of handle.createReadStream({ autoClose: false })) {
            size += chunk.length;
            if (size > limit) throw new Error('SEC_DOCUMENT_TOO_LARGE');
            chunks.push(chunk);
          }
          const document = documentFromBytes(Buffer.concat(chunks, size), /\.html?$/i.test(row.file_path) ? 'text/html' : 'text/plain');
          if (row.checksum && document.checksum !== row.checksum) throw new Error('CHECKSUM_MISMATCH');
          const result = await db.query(`UPDATE filings SET document_content=$3,
            document_content_type=$4, document_size_bytes=$5, checksum=$6,
            document_downloaded_at=now(), updated_at=now(), status='downloaded', error_message=NULL
            WHERE accession_no=$1 AND cik=$2 AND document_content IS NULL AND file_path=$7
            RETURNING accession_no`, [...cursor,document.documentContent,document.documentContentType,
            document.documentSizeBytes,document.checksum,row.file_path]);
          summary.imported += result[1];
        } catch (error) {
          summary.failed++;
          console.error(JSON.stringify({ accessionNo: row.accession_no, cik: row.cik, error: error.code ?? error.message }));
        } finally {
          await handle?.close();
        }
      }
    }
    console.log(JSON.stringify(summary));
    if (summary.failed) process.exitCode = 1;
  } finally { await app.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
