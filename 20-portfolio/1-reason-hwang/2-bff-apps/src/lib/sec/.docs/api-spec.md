# SEC upstream API used by this BFF

Implementation contract: `../sec.client.ts` owns HTTP and external response types; `../sec.archive.ts` parses bulk/historical data.

| Request | Purpose |
| --- | --- |
| GET https://www.sec.gov/files/company_tickers.json | SEC ticker/company snapshot: cik_str, ticker, title |
| GET https://data.sec.gov/submissions/CIK{cik10}.json | Company metadata, filings.recent columns, filings.files historical file descriptors |
| GET https://data.sec.gov/submissions/{historicalFileName} | Older parallel submission columns; name is validated before requesting |
| GET https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip | Bulk company and historical submission JSON; does not contain filing documents |
| GET https://www.sec.gov/Archives/edgar/data/{cik}/{accessionWithoutHyphens}/{primaryDocument} | Filing document; fallback `{accession}.txt` for historical records without primary document |

- `SEC_USER_AGENT` provides the caller contact. Shared client throttles requests (default 4/sec), retries transient errors (`SEC_RETRY_COUNT`, default 3).
- Request timeout: JSON/documents 60 seconds, large archive 60 minutes. Document maximum defaults to 32 MiB; UTF-8, nonempty and NUL checks precede persistence.
- Archive is cached in `DATA_DIR/sec-cache/submissions.zip`; refreshArchive replaces it through a temporary file and atomic rename.
- Scope: 10-K, 10-Q, 8-K and amendments, filtered by filing date. Bulk metadata is read before optional document downloads.
