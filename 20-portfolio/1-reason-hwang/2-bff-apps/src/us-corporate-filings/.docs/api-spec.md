# US Corporate Filings BFF API

Prefix: `/api/sec`. Swagger: `/docs/sec`.

| Method | Path | Response |
| --- | --- | --- |
| POST | /company-sync-jobs | 201 JSON: syncedCount, requestedAt, correlationId |
| GET | /companies | 200 JSON: filters, items, pagination |
| GET | /filings/:cik/:accessionNo/content | 200 raw HTML/XML/text |
| GET | /filings | 200 JSON: filters, items, pagination |
| POST | /company-filing-sync-jobs | 200 SSE: selected company backfill |
| POST | /all-company-filing-sync-jobs | 200 SSE: bulk backfill |

## Query

Companies: page=1, pageSize=50 (max 100000), legacy limit fallback, cik/ticker/q.
Filings: page=1, pageSize=50 (max 500), legacy limit fallback, cik/ticker/since/formType/status/parserStatus, includeContent=false, includeAmendments=true.
Pagination: page, pageSize, totalItems, totalPages, hasNextPage. Empty result totalPages=0.
CIKs normalize to 10 digits, tickers uppercase. Invalid page/date/filter returns 400.
Raw content only with includeContent=true; missing body yields content=null. Page body limit 64 MiB, otherwise 413.

## Backfill

Selected: `{ "ciks": ["320193"], "years": 20, "downloadDocuments": true }`.
`tickers` also accepted; at least one target required. `since` overrides years. Unknown companies produce an SSE error; sync companies first.
All: `{ "years": 20, "refreshArchive": false, "downloadDocuments": true }`.
Years 1..30 (default 20). Metadata comes first. Documents default on; false skips them. Existing downloaded bodies/parser state survive reruns; failed documents are reset once and retried.
Supported forms: 10-K, 10-Q, 8-K and amendments. Selected includes historical files, bulk includes archive JSON.

Both requests stay open until completion and emit:

```text
event: started
data: {"startedAt":"..."}

event: progress
data: {"phase":"metadata","filingsSynced":100}

event: progress
data: {"phase":"documents","downloaded":10,"failed":0}

event: completed
data: {"companiesProcessed":1,"filingsSynced":100,"downloaded":100,"failed":0}
```

All-company metadata progress uses processedEntries/companiesUpserted/filingsSeen/filingsUpserted. Archive progress includes archiveBytes. Skipped documents emit `{phase:"documents",skipped:true}`.
HTTP 400 validation precedes SSE. Once started, failures emit `event: error` with message/statusCode (including 404 missing company, 409 concurrent bulk, 502 upstream). completed with failed>0 reports partial document failure. Check the final event and counters, not just HTTP 200.
Heartbeat comments every 15 seconds. No runId, job table writes, status GET, replay or automatic reconnect. Disconnect stops at a subsequent progress checkpoint; committed data is preserved. Rerun to resume.

```sh
curl -N -X POST http://localhost:2801/api/sec/all-company-filing-sync-jobs \
  -H 'Content-Type: application/json' \
  -d '{"years":20,"refreshArchive":false,"downloadDocuments":true}'
```

Browser clients use streaming fetch (native EventSource cannot POST). Configure proxy timeouts for long streams and disable buffering.

Old download/retry/status-summary/downloaded-reports/parser-status and all backfill status GET routes return 404. Use filings with includeContent=true and rerun backfill instead. Historical database migrations and legacy execution records are retained but not used by the application.

## SEC-AMEND-001: Original plus amendments

Each matched item keeps its filing metadata and adds `original`, `amendments`, `amendmentLinkStatus`, and `amendmentLinkBasis` by default. Set includeAmendments=false for a flat response. Pagination counts matching filing records, not report groups; related documents are not restricted to the current page/since/status filter.

Link by equal CIK, base form (10-K/A → 10-K), and reportDate. An amendment must have exactly one original submitted no later than it (acceptedAt is also checked when both are available). This is conservative metadata linkage, not a guarantee of legally complete amendment scope.

- linked: original is available, amendments sorted by filing date/accession.
- missing-original: no eligible original; original=null, amendment remains visible.
- ambiguous-original: several eligible originals; do not guess, original=null.
- missing-report-date: cannot establish the period; keep the selected record visible without speculative linking.

No automatic merging, replacement, or “latest file is complete” inference. Original financial statements and partial/full amendments remain separate. includeContent=true includes every linked document body; the 64 MiB response budget counts repeated nested bodies as actually returned. Bodyless records have content=null.

## SEC-CONTENT-001: 단일 원문 직접 조회

`GET /api/sec/filings/:cik/:accessionNo/content`는 CIK+접수번호로 저장된 대표 원문 한 건을 찾고 JSON 포장 없이 UTF-8로 반환한다. CIK는 1~10자리 숫자를 10자리로 정규화하며 접수번호는 `##########-##-######` 형식이다. 목록 응답의 cik/accessionNo를 사용한다. 원본·수정본은 각각의 접수번호로 조회하며 병합하지 않는다. SEC 추가 요청이나 파일 fallback은 없다.

저장된 documentContentType의 MIME을 사용한다: text/html, application/xhtml+xml, application/xml, text/xml, text/plain. 알 수 없거나 누락된 MIME은 text/plain으로 반환한다. 저장된 문자열을 변환하지 않으며 charset은 UTF-8이다. 400은 잘못된 식별자, 404는 공시 없음, 409는 pending/failed 또는 본문 없음이며 오류 응답은 JSON이다.

브라우저 표시용 Content-Disposition:inline, X-Content-Type-Options:nosniff와 CSP sandbox를 적용한다. 인라인 스타일·data 이미지만 허용하며 스크립트·외부 자원은 차단하므로 SEC 사이트와 화면 모양이 다를 수 있다.

## SEC-TICKER-SCOPE-001: 전체 백필의 티커 제한

POST /all-company-filing-sync-jobs는 실행 시작 시 DB companies에서 ticker가 NULL/빈 문자열/공백이 아닌 회사의 CIK 목록을 고정한다. ZIP의 recent와 history 모두 이 목록에 해당하는 회사만 적재하며 원문 다운로드·실패 재시도에도 동일한 CIK 목록을 적용한다. 기존에 저장된 티커 없는 등록자의 pending/failed 공시는 건드리지 않는다. 지정 기업 백필은 기존 CIK/ticker 명시 방식 그대로다.

먼저 회사 동기화를 실행해야 한다. 대상이 0이면 SSE error(statusCode=404)로 종료하고 archive를 읽거나 전체 범위로 확대하지 않는다. progress 및 completed에 tickerOnly:true와 totalCompanies를 제공한다. 전체 SEC ZIP 자체의 다운로드 크기는 줄지 않지만 저장·문서 다운로드 범위는 제한된다. 티커 존재는 현재 상장기업임을 보장하지 않으며, DB에 남은 과거 티커도 포함될 수 있다. 기존 수집 데이터는 삭제하지 않는다.
