# US Corporate Filings BFF API

Prefix: `/api/sec`. Swagger: `/docs/sec`.

| Method | Path | Response |
| --- | --- | --- |
| POST | /company-sync-jobs | 201 JSON: syncedCount, requestedAt, correlationId |
| GET | /overview | 200 JSON: 전체 기업·공시 및 양식별 원문 보유 집계 |
| GET | /companies | 200 JSON: pagination, items |
| GET | /filings/:cik/:accessionNo/content | 200 raw HTML/XML/text |
| POST | /filings/:cik/:accessionNo/download-jobs | 200 SSE: download or retry this filing only |
| GET | /filings | 200 JSON: filters, items, pagination |
| POST | /company-filing-sync-jobs | 200 SSE: selected company backfill |
| POST | /all-company-filing-sync-jobs | 200 SSE: bulk backfill |

## Query

Companies: page=1, pageSize=50 (max 100000), legacy limit fallback, cik/ticker/q.
Filings: page=1, pageSize=50 (max 500), legacy limit fallback, cik/ticker/since/formType/status/parserStatus, includeContent=false, includeAmendments=true, includeFormerRegistrants=false. Setting includeFormerRegistrants=true requires an explicit cik (otherwise 400) and includes that issuer even when its current ticker is empty.
Pagination: page, pageSize, totalItems, totalPages, hasNextPage. Empty result totalPages=0.
CIKs normalize to 10 digits, tickers uppercase. Invalid page/date/filter returns 400.
Raw content only with includeContent=true; missing body yields content=null. Page body limit 64 MiB, otherwise 413.

## Single filing download

`POST /filings/:cik/:accessionNo/download-jobs` accepts no body and streams `started`, `progress`, and `completed` or `error`. It requires the filing metadata to already exist, downloads only the matching CIK+accession document, and retries rows in `failed` state. An already-downloaded document is left unchanged and returns a completed event with `skipped: true`.

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

Legacy downloaded-reports, parser-status, status-summary and backfill status GET routes return 404. Use filings with includeContent=true for stored content, the accession-specific download-jobs POST for one filing, or the selected/all-company SSE POST for a date range. Historical database migrations and legacy execution records are retained but not used by the application.

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

## SEC-QUERY-TICKER-001: 목록 조회의 기본 범위

GET /companies와 GET /filings의 기본값은 DB companies.ticker가 NULL·빈 문자열·공백이 아닌 회사만 반환하는 것이다. cik/ticker/q 등 기존 필터와 AND로 결합하며 totalItems/totalPages에도 동일 조건을 적용한다. 기본값에서 티커 없는 회사 CIK를 지정하면 빈 목록이다. GET /filings에 한해 명시적 cik와 includeFormerRegistrants=true를 함께 지정하면 법인 재편 등으로 티커가 없는 등록자도 조회할 수 있다(SEC-IUI-002). 회사 데이터나 공시를 삭제하지 않으며 현재 상장 여부를 의미하지 않는다. CIK+accessionNo로 이미 저장된 단일 원문을 조회하는 API는 이 목록 필터와 별개로 유지한다.

## SEC-MODELING-001: 독립 모델링 작업 API

공통 경로 `/api/sec/modeling`. 원문은 PostgreSQL에 보존하고, BFF는 내부 FastAPI에 원문·메타데이터·실행 토큰을 전달한다. 모델링 결과·검색·근거는 Neo4j에서 조회한다. 기존 collector의 `parserStatus`나 SSE 작업과 별도 계약이다.

| 메서드 | 경로 | 응답 / 동작 |
| --- | --- | --- |
| GET | `/filings?cik=&limit=20&offset=0` | `{items,total}`. 각 공시의 `stages[1..3]`에 `readiness`, `status`, `latestRun`, 공개 `generationId`를 제공한다. |
| POST | `/filings/:cik/:accessionNo/model-:stage/runs` | 202 `{runId,status:"QUEUED"}`. stage 1/2/3. body `{extractionModel?:"gpt-5.6-sol"|"gpt-5.6-luna"}`. 기본 sol. |
| GET | `/runs?cik=&accessionNo=&limit=50&offset=0` | `{items,total}`. 실행 설정, 상태, 입력/출력 세대, 오류, 집계, 시각을 반환한다. |
| GET | `/runs/:runId` | 실행 상세와 최대 2,000개의 `workUnits`, 전체 개수 `workUnitsTotal`, 잘림 여부 `workUnitsTruncated`. 초기 3개 공시의 전체 작업 단위를 포함한다. |
| GET | `/runs/:runId/events?cursor=0` | 증가하는 문자열 ID 순서의 `{items,nextCursor}`, 페이지당 최대 100건. |
| POST | `/runs/:runId/cancel` | 200 실행 상태. 대기 작업은 즉시 CANCELLED, 실행 중 작업은 `cancelRequested=true` 후 내부 취소·게시 결과를 확인한다. |
| POST | `/runs/:runId/retry` | FAILED/CANCELLED 실행을 새 run으로 생성, 202 `{runId,status}`. 기존 이력 보존. |
| GET | `/filings/:cik/:accessionNo/results/:stage?limit=50&offset=0` | Python 결과를 전달. `{stage,generationId,items,total,offset,limit}`, 미처리 결과는 빈 items. |
| POST | `/search` | `{query,filingIds,itemCodes?,topK?}`를 내부 검색 API로 전달. |
| POST | `/facts/query` | `{filingIds,conceptQName?,period?,dimensions?,unit?,offset?,limit?}`를 재무 사실 검색 API로 전달. |
| GET | `/evidence/:id` | 검색 결과의 evidence ID를 URL 인코딩해 조회. |

- CIK는 10자리로 정규화하고 accession은 `0000320193-26-000026` 형식이다. filingId는 `filing:{cik}:{accessionNo}`이다.
- `readiness`: `input_required`, `unprocessed`, `ready`, `stale`. 실행 상태 `QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED`와 구분한다. 실패한 새 실행이 이전 공개 결과를 지우지 않는다.
- 400 잘못된 입력, 404 없는 공시/실행, 409 중복 활성 실행 또는 선행 입력 부족. 모델링 2는 현재 원문 해시와 일치하는 모델링 1 공개 세대가 필요하다.
- PostgreSQL `sec_modeling.jobs/runs/work_units/events`가 작업 이력 원본이다. 하나의 실행자가 짧은 advisory transaction + 원자적 claim으로 작업을 가져간다. HTTP 대기 동안 DB 트랜잭션을 유지하지 않는다.
- 실행이 종료되면 미완료 work unit도 같은 트랜잭션에서 종료 상태로 전환하고 `payload.terminalReason`에 사유를 기록한다. 이미 SUCCEEDED/FAILED/CANCELLED/INTERRUPTED인 작업 단위는 보존한다. 대기 실행 취소에도 같은 규칙을 적용한다. 기동 시 이미 종료된 실행에 남아 있던 미완료 작업 단위도 멱등적으로 정합성을 복구한다.
- lease 90초, heartbeat 15초. 실행 토큰으로 오래된 실행자의 쓰기를 차단한다. 연결 종료/재시작 시 Neo4j 공개 manifest를 확인하고 성공을 복구하거나 이전 실행을 취소한 후 실패 이력을 남긴다.
- 날짜는 시간대 변환 없이 `YYYY-MM-DD`로 반환한다. 원문과 서비스 키는 목록·이벤트·실행 설정에 포함하지 않는다.
- 로컬 개발용 API이며 사용자별 권한 체계를 제공하지 않는다. 외부 공개 전에 접근 제어가 필요하다.

### 내부 계약과 설정

`POST /internal/sec-modeling/model-{1|2|3}/runs`는 `X-SEC-Modeling-Key` 헤더와 `{runId,executionToken,cik,accessionNo,sourceHtml?,sourceHash,metadata,inputGenerationId?,extractionModel}`를 받는다. 모델링 1/3만 원문을 전달한다. NDJSON `progress/completed/error` 이벤트를 영속 기록한다. `completed`는 공개 generationId를 포함해야 한다.

- `SEC_MODELING_URL`: 내부 Python 주소, 기본 `http://127.0.0.1:2981`.
- `SEC_MODELING_KEY`: 두 서비스에 같은 비밀값 설정. 브라우저에 전달하지 않는다. 미설정 BFF는 작업 claim을 시작하지 않는다.
- `SEC_MODELING_WORKER_ENABLED`: 기본 true. 격리 검증 또는 조회 전용 BFF에서는 false.
- `pnpm -C 2-bff-apps test:modeling:e2e`: 소유한 임시 PostgreSQL·Nest HTTP와 외부 모델링 fixture로 중복/취소/재시도/lease/복구/날짜/페이지 경계 검증, Bruno 07-modeling 실행, 자원 정리.
- `pnpm -C 2-bff-apps test:modeling:live`: 명시적 opt-in 실제 AAPL/CPNG/NVDA 모델링 1/3 실행. `SEC_MODELING_BFF_URL` 기본 `http://127.0.0.1:3980/api/sec/modeling`. 새 실행 이력과 공개 세대를 생성하고 기존 데이터는 보존한다. `SEC_MODELING_STAGES=2`는 모델링 2만 검증하며 실제 LLM·임베딩 캐시가 없다면 외부 호출 비용이 발생한다.

GET /filings returns hasContent for each listed filing, based on non-null and nonempty stored document_content. GET /overview counts all company and filing rows, including non-ticker registrants; tickerCompanies counts nonblank tickers and forms groups each actual form_type separately.

GET /filings accepts optional `until` (inclusive filing date) and `hasContent` (true/false). These filters apply before pagination; hasContent uses non-null, nonempty stored document content.

## SEC-MODELING-UI-002: 모델링 관리 목록·통계

- `GET /api/sec/modeling/filings`: 기존 `items/total`을 유지하고 `limit/offset`을 반환한다. limit은1~100(default20), offset은0~1000000(default0)이다.
- `GET /api/sec/modeling/overview`: 페이지와 무관한 필터 전체 집계다. `scope=filtered`, `filters`, `totalFilings`, `sourceCollected`, `sourceMissing`, `stages`, `retrievedAt`을 반환한다.
- 두 GET의 공통 필터는 `cik`, `q`(최대100자 회사명/ticker/CIK/accession 부분 검색), `formType`(10-K/10-K/A/10-Q), `sourceStatus`(all/collected/missing)다.
- 각 stages[1/2/3] 집계는 supported/unsupported와 latestRuns의 QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED/unprocessed다. latestRuns는 지원 공시의 최신 job run만 집계하며, **게시 준비 상태나 현재 페이지 합계가 아니다**.
- 목록의 실제 publication 준비 상태는 인증된 Python batch로 조회한다. Python 장애/불완전 응답 시 행은 유지하고 unavailable을 명시한다. overview는 PostgreSQL 집계만 사용한다.
- 기존 create/cancel/retry/results/search/facts/evidence 경로는 유지한다. create body는 `{}` 또는 optional extractionModel만 허용하며 잘못된 JSON schema는400이다. retry는 저장 extractionModel을 재사용한다.

배포 순서·오류·필터 상세는 [BFF 모델링 관리 조회](../../../../docs/stock/tech-shared/2-bff-apps/sec-modeling-dashboard.md)를 따른다. 신규 BFF는 Python batch API가 필요하므로 Python을 먼저 배포하는 순서를 권장한다.
