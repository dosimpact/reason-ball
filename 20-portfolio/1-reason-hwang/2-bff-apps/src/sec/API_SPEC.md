# SEC Collector API Specification

## 1. 문서 목적

이 문서는 `2-bff-apps/src/sec` 모듈이 현재 제공하는 HTTP API 계약을 정리한 AS-IS 명세다. 구현 기준은 다음 파일이다.

- `api/collector.controller.ts`: 라우팅, 입력 정규화 및 검증
- `api/dto/swagger.dto.ts`: OpenAPI 요청·응답 스키마
- `companies-sync/companies-sync.service.ts`: 회사 동기화 및 조회
- `filings-collector/filings-collector.service.ts`: 공시 수집, 다운로드, 조회 및 상태 변경
- `bruno-api-tests`: 실행 가능한 API 시나리오

## 2. 공통 계약

| 항목 | 값 |
| --- | --- |
| 로컬 서버 | `http://localhost:2801` |
| API base path | `/api/sec` |
| Swagger UI | `/docs/sec` |
| Content-Type | JSON body 사용 시 `application/json` |
| 인증 | 현재 없음 |
| 데이터베이스 | PostgreSQL / TypeORM |
| 외부 데이터 소스 | SEC EDGAR |

### 2.1. Correlation ID

상태를 변경하거나 외부 I/O를 수행하는 POST API는 선택적으로 `x-request-id` 요청 헤더를 받는다.

```http
x-request-id: collector-request-001
```

- 값이 있으면 공백을 제거해 `correlationId`로 사용한다.
- 값이 없거나 빈 문자열이면 `collector-job-{timestamp}` 형식으로 생성한다.
- 응답 body와 서버 로그에 같은 `correlationId`가 포함된다.
- 현재 응답 헤더에 `x-request-id`를 다시 설정하는 동작은 없다.

### 2.2. HTTP 상태 코드

| 상태 | 의미 |
| --- | --- |
| `200 OK` | GET 조회 성공 |
| `201 Created` | POST 작업 완료 |
| `202 Accepted` | bulk backfill background 작업 시작 |
| `400 Bad Request` | 입력 형식 또는 허용값 오류 |
| `404 Not Found` | parser 상태 변경 대상 filing이 없음 |
| `500 Internal Server Error` | DB, SEC 통신, 파일 I/O 등 처리 중 오류 |

POST 경로 이름에 `jobs`가 포함되어 있지만 현재 구현은 작업 ID를 발급하는 비동기 큐 방식이 아니다. HTTP 요청 안에서 SEC 호출, DB 변경 또는 파일 다운로드를 완료한 후 결과를 반환한다.

### 2.3. 공통 입력 정규화

| 필드 | 규칙 |
| --- | --- |
| `cik` | 숫자 1~10자리, 왼쪽을 `0`으로 채워 10자리로 변환 |
| `ticker` | 대문자로 변환, `A-Z`, `0-9`, `.`, `-`만 허용, 최대 32자 |
| `since` | `YYYY-MM-DD` 문자열 |
| `status` | `pending`, `downloaded`, `failed` 중 하나, 소문자로 정규화 |
| 양의 정수 | `0`보다 커야 함 |
| 음이 아닌 정수 | `0` 이상이어야 함 |
| `ciks`, `tickers` | JSON 배열 또는 쉼표로 구분된 문자열, 중복 제거 |
| `parserStatus` | 앞뒤 공백 제거, 최대 255자 |
| `accessionNo` | 영문, 숫자, `-`만 허용, 1~32자 |

잘못된 요청의 기본 응답은 NestJS 표준 오류 형식을 따른다.

```json
{
  "statusCode": 400,
  "message": "cik must contain 1 to 10 digits.",
  "error": "Bad Request"
}
```

## 3. API 목록

| Method | Path | 설명 | 주요 부작용 |
| --- | --- | --- | --- |
| POST | `/company-sync-jobs` | SEC 회사 마스터 동기화 | SEC 호출, `companies` upsert |
| GET | `/companies` | 회사 목록 조회 | 없음 |
| POST | `/filing-sync-jobs` | 공시 메타데이터 동기화 | SEC 호출, `filings` upsert |
| POST | `/filing-backfill-jobs` | 전체 기업 최근 N년 bulk backfill 시작 | SEC bulk 다운로드, 대량 upsert |
| GET | `/filing-backfill-jobs/latest` | 최근 bulk backfill 상태 조회 | 없음 |
| GET | `/filing-backfill-jobs/:runId` | 지정 bulk backfill 상태 조회 | 없음 |
| GET | `/filing-backfill-jobs/:runId/verification` | bulk backfill DB 완전성 검증 | 집계 쿼리 |
| POST | `/filing-download-jobs` | pending 공시 원문 다운로드 | PostgreSQL 원문 저장, 상태 변경 |
| POST | `/filing-retry-jobs` | failed 공시 재시도 준비 | 상태 변경 |
| GET | `/filings/status-summary` | 공시 상태별 집계 | 없음 |
| GET | `/filings` | 공시 메타데이터 목록 조회 | 없음 |
| GET | `/filings/downloaded-reports` | 다운로드된 보고서 본문 조회 | PostgreSQL 원문 조회 |
| POST | `/filings/parser-status` | parser 후처리 상태 갱신 | 상태 변경 |

## 4. Company API

### 4.1. 회사 마스터 동기화

```http
POST /api/sec/company-sync-jobs
x-request-id: company-sync-001
```

Request body는 없다. SEC의 `company_tickers.json`을 읽어 CIK 기준으로 `companies` 테이블을 upsert한다.

#### 성공 응답: `201 Created`

```json
{
  "job": "companies:sync",
  "correlationId": "company-sync-001",
  "requestedAt": "2026-08-25T01:00:00.000Z",
  "syncedCount": 10234
}
```

### 4.2. 회사 목록 조회

```http
GET /api/sec/companies?page=1&pageSize=50&cik=320193&ticker=aapl&q=apple
```

| Query | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `page` | 아니요 | `1` | 1부터 시작하는 페이지 |
| `pageSize` | 아니요 | `50` | 페이지 크기, 최대 `500`; limit보다 우선 |
| `limit` | 아니요 | `50` | pageSize의 호환 별칭 |
| `cik` | 아니요 | - | CIK 정확 일치 |
| `ticker` | 아니요 | - | ticker 정확 일치 |
| `q` | 아니요 | - | 회사명 또는 ticker의 대소문자 무시 부분 검색 |

#### 성공 응답: `200 OK`

```json
{
  "filters": {
    "limit": 50,
    "page": 1,
    "pageSize": 50,
    "cik": "0000320193",
    "ticker": "AAPL",
    "q": "apple"
  },
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false
  },
  "items": [
    {
      "cik": "0000320193",
      "ticker": "AAPL",
      "name": "Apple Inc.",
      "sic": 3571,
      "updatedAt": "2026-08-25T01:00:00.000Z"
    }
  ]
}
```

정렬 순서는 `updatedAt DESC`, `cik ASC`다.

전체 건수는 검색 조건 적용 후 계산한다. 빈 검색 결과의 totalPages는 0이며 범위 밖 페이지는 items=[]를 반환한다. page/pageSize(또는 limit)는 양의 안전 정수여야 하며 빈 값·소수·잘못된 문자열·반복 파라미터와 안전 범위를 넘는 offset은 400이다. 크기는 500으로 제한하며 filters.limit도 실제 적용 크기를 반환한다. 페이지 간 동시 데이터 변경의 snapshot 일관성은 보장하지 않는다.

## 5. Filing Job API

### 5.1. 공시 메타데이터 동기화

```http
POST /api/sec/filing-sync-jobs
Content-Type: application/json
x-request-id: filing-sync-001
```

```json
{
  "page": 1,
  "pageSize": 100,
  "since": "2025-01-01",
  "ciks": ["0000320193"],
  "tickers": ["AAPL"]
}
```

| Body | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `page` | 아니요 | `1` | 처리할 회사 페이지 |
| `pageSize` | 아니요 | `100` | 페이지당 회사 수 |
| `limitCompanies` | 아니요 | `100` | `pageSize`의 deprecated 별칭 |
| `since` | 아니요 | - | 해당 날짜 이후 filing만 수집 |
| `ciks` | 아니요 | - | 대상 CIK 목록 |
| `tickers` | 아니요 | - | 대상 ticker 목록 |

`ciks` 또는 `tickers`가 있으면 지정 대상을 직접 처리하며 응답의 `page`는 `1`이 된다. 수집 대상 form은 다음과 같다.

```text
10-K, 10-K/A, 10-Q, 10-Q/A, 8-K, 8-K/A
```

#### 성공 응답: `201 Created`

```json
{
  "job": "filings:sync",
  "correlationId": "filing-sync-001",
  "requestedAt": "2026-08-25T01:00:00.000Z",
  "options": {
    "page": 1,
    "pageSize": 100,
    "since": "2025-01-01",
    "ciks": ["0000320193"],
    "tickers": ["AAPL"]
  },
  "pagination": {
    "page": 1,
    "pageSize": 100,
    "totalCompanies": 1,
    "totalPages": 1,
    "hasNextPage": false
  },
  "companiesProcessed": 1,
  "filingsSynced": 42
}
```

### 5.2. 전체 기업 20년 bulk backfill

```http
POST /api/sec/filing-backfill-jobs
Content-Type: application/json
```

```json
{
  "years": 20,
  "refreshArchive": true
}
```

| Body | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `years` | 아니요 | `20` | 적재 기간, 1~30년 |
| `refreshArchive` | 아니요 | `false` | SEC nightly bulk archive를 새로 다운로드할지 여부 |

SEC 공식 `submissions.zip`을 한 번 내려받아 압축을 디스크에 풀지 않고 JSON entry를 순차 처리한다. 각 기업의 recent payload와 historical `*-submissions-*.json`을 모두 읽고 대상 form만 PostgreSQL에 batch upsert한다. 동일 API를 다시 실행해도 `(accessionNo, cik)` 복합 PK로 중복되지 않는다.

응답은 `202 Accepted`이며 실제 작업은 서버 background에서 계속된다.

```json
{
  "runId": "e52dd626-8d43-4da5-85b3-a86cab36a546",
  "status": "queued",
  "cutoffDate": "2006-08-24",
  "targetForms": ["10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "8-K/A"],
  "processedEntries": "0",
  "companiesUpserted": "0",
  "filingsSeen": "0",
  "filingsUpserted": "0"
}
```

진행 상태와 검증 결과는 다음 API로 조회한다.

```http
GET /api/sec/filing-backfill-jobs/latest
GET /api/sec/filing-backfill-jobs/{runId}
GET /api/sec/filing-backfill-jobs/{runId}/verification
```

run 상태는 `queued -> downloading -> running -> completed`이며 오류 발생 시 `failed`가 된다. 동시에 하나의 active run만 허용한다. verification 응답의 `metadataComplete`는 run 완료, 적재 개수 일치, 유효 form/date, company row 및 공식 filing URL 존재를 함께 검사한다.

### 5.3. pending 공시 다운로드

```http
POST /api/sec/filing-download-jobs
Content-Type: application/json
```

```json
{
  "maxFiles": 100,
  "since": "2025-01-01",
  "ciks": ["0000320193"],
  "tickers": ["AAPL"]
}
```

| Body | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `maxFiles` | 아니요 | `500` | 최대 다운로드 시도 수, `0` 허용 |
| `since` | 아니요 | - | filing date 하한 |
| `ciks` | 아니요 | - | 대상 CIK 목록 |
| `tickers` | 아니요 | - | 대상 ticker 목록 |

#### 성공 응답: `201 Created`

```json
{
  "job": "filings:download",
  "correlationId": "collector-job-abc123",
  "requestedAt": "2026-08-25T01:00:00.000Z",
  "options": {
    "maxFiles": 100,
    "since": "2025-01-01",
    "ciks": ["0000320193"],
    "tickers": ["AAPL"]
  },
  "queued": 10,
  "downloaded": 9,
  "failed": 1
}
```

정상 처리에서는 `downloaded + failed = queued`다.

### 5.4. 실패 공시 재시도 준비

```http
POST /api/sec/filing-retry-jobs
Content-Type: application/json
```

```json
{
  "limit": 200,
  "cik": "0000320193",
  "since": "2025-01-01"
}
```

| Body | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `limit` | 아니요 | `200` | 변경할 최대 filing 수 |
| `cik` | 아니요 | - | 특정 회사로 제한 |
| `since` | 아니요 | - | filing date 하한 |

`failed` 상태를 `pending`으로 변경하고 `errorMessage`를 `null`로 초기화한다. `retryCount`는 이 API에서 초기화하지 않는다.

#### 성공 응답: `201 Created`

```json
{
  "job": "filings:retry-failed",
  "correlationId": "collector-job-abc123",
  "requestedAt": "2026-08-25T01:00:00.000Z",
  "options": {
    "limit": 200,
    "cik": "0000320193",
    "since": "2025-01-01"
  },
  "resetCount": 12
}
```

## 6. Filing Query API

### 6.1. 상태 요약

```http
GET /api/sec/filings/status-summary?cik=0000320193&since=2025-01-01
```

| Query | 필수 | 설명 |
| --- | --- | --- |
| `cik` | 아니요 | 특정 회사로 제한 |
| `since` | 아니요 | filing date 하한 |

#### 성공 응답: `200 OK`

```json
{
  "filters": {
    "cik": "0000320193",
    "since": "2025-01-01"
  },
  "total": 250,
  "pending": 31,
  "downloaded": 210,
  "failed": 9
}
```

항상 `total = pending + downloaded + failed` 관계를 만족한다.

### 6.2. 공시 목록

```http
GET /api/sec/filings?limit=50&status=downloaded&cik=0000320193&since=2025-01-01&parserStatus=completed
```

| Query | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `limit` | 아니요 | `50` | 조회 개수, 서비스 최대 `500` |
| `status` | 아니요 | - | `pending`, `downloaded`, `failed` |
| `cik` | 아니요 | - | CIK 정확 일치 |
| `since` | 아니요 | - | filing date 하한 |
| `parserStatus` | 아니요 | - | parser 상태 정확 일치, 빈 문자열 허용 |

#### 성공 응답: `200 OK`

```json
{
  "filters": {
    "limit": 50,
    "status": "downloaded",
    "cik": "0000320193",
    "since": "2025-01-01",
    "parserStatus": "completed"
  },
  "items": [
    {
      "accessionNo": "0000320193-25-000079",
      "cik": "0000320193",
      "formType": "10-K",
      "filingDate": "2025-11-01",
      "reportDate": "2025-09-27",
      "primaryDoc": "aapl-20250927.htm",
      "filingUrl": "https://www.sec.gov/Archives/edgar/data/...",
      "status": "downloaded",
      "filePath": null,
      "checksum": "sha256-value",
      "parserStatus": "completed",
      "errorMessage": null,
      "retryCount": 0,
      "updatedAt": "2026-08-25T01:00:00.000Z"
    }
  ]
}
```

정렬 순서는 `filingDate DESC NULLS LAST`, `updatedAt DESC`다.

### 6.3. 다운로드된 보고서 본문 조회

```http
GET /api/sec/filings/downloaded-reports?page=1&pageSize=20&formType=10-K&ticker=AAPL
```

| Query | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `page` | 아니요 | `1` | 1부터 시작하는 페이지 |
| `pageSize` | 아니요 | `50` | 페이지 크기, 서비스 최대 `500` |
| `formType` | 아니요 | - | 대문자로 변환 후 정확 일치 |
| `cik` | 아니요 | - | CIK 정확 일치 |
| `ticker` | 아니요 | - | 회사 ticker 정확 일치 |
| `since` | 아니요 | - | filing date 하한 |
| `parserStatus` | 아니요 | - | parser 상태 정확 일치, 빈 문자열 허용 |

조회 대상은 `status=downloaded`이고 `document_content`가 존재하는 filing이다. PostgreSQL `sec_collector.public.filings`에 저장한 원문을 `content`로 반환한다. 신규 다운로드의 `filePath`는 `null`이며 이 필드는 폐기 예정이다. 원문 합계가 64 MiB를 초과하는 페이지는 HTTP 413을 반환하므로 `pageSize`를 줄여야 한다.

#### 성공 응답: `200 OK`

```json
{
  "filters": {
    "page": 1,
    "pageSize": 20,
    "formType": "10-K",
    "ticker": "AAPL"
  },
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 120,
    "totalPages": 6,
    "hasNextPage": true
  },
  "items": [
    {
      "accessionNo": "0000320193-25-000079",
      "cik": "0000320193",
      "ticker": "AAPL",
      "formType": "10-K",
      "filingDate": "2025-11-01",
      "reportDate": "2025-09-27",
      "primaryDoc": "aapl-20250927.htm",
      "filingUrl": "https://www.sec.gov/Archives/edgar/data/...",
      "filePath": null,
      "checksum": "sha256-value",
      "parserStatus": "completed",
      "updatedAt": "2026-08-25T01:00:00.000Z",
      "content": "<html>...</html>"
    }
  ]
}
```

로컬 파일을 읽지 않는다. DB 조회 오류는 `500`, 원문 합계 64 MiB 초과는 `413`이다. 본문 크기가 크므로 `pageSize`를 작게 사용한다.

## 7. Parser Status API

### 7.1. parser 상태 변경

```http
POST /api/sec/filings/parser-status
Content-Type: application/json
x-request-id: parser-status-001
```

```json
{
  "accessionNo": "0000320193-25-000079",
  "cik": "0000320193",
  "parserStatus": "completed"
}
```

| Body | 필수 | 설명 |
| --- | --- | --- |
| `accessionNo` | 예 | filing accession number |
| `cik` | 예 | filing CIK |
| `parserStatus` | 아니요 | 설정할 상태, 생략하면 빈 문자열 |

#### 성공 응답: `201 Created`

```json
{
  "job": "filings:parser-status-updated",
  "correlationId": "parser-status-001",
  "requestedAt": "2026-08-25T01:00:00.000Z",
  "accessionNo": "0000320193-25-000079",
  "cik": "0000320193",
  "parserStatus": "completed"
}
```

`accessionNo`와 `cik`에 해당하는 복합 PK row가 없으면 `404 Not Found`를 반환한다.

## 8. Filing 상태 모델

```text
SEC metadata sync
       |
       v
    pending -------- download success -------> downloaded
       |                                           |
       +--------- download failure ----------> failed
                                                  |
                                                  | retry API
                                                  v
                                               pending
```

`parserStatus`는 위 다운로드 상태와 별개의 후처리 상태 문자열이다. 전용 enum은 없으며 빈 문자열 또는 최대 255자의 사용자 정의 상태를 저장한다.

| 상태 | 의미 |
| --- | --- |
| `pending` | 메타데이터가 적재됐지만 원문 다운로드 전이거나 재시도 대기 중 |
| `downloaded` | 원문 저장과 checksum 생성 완료 |
| `failed` | 다운로드 실패, `errorMessage`와 증가한 `retryCount` 보유 가능 |

## 9. 데이터 모델

### Company

| 필드 | 타입 | Null | 설명 |
| --- | --- | --- | --- |
| `cik` | string(10) | 아니요 | PK |
| `ticker` | string(32) | 예 | 거래소 ticker |
| `name` | text | 아니요 | 회사명 |
| `sic` | integer | 예 | 산업 분류 코드 |
| `updatedAt` | datetime | 아니요 | 갱신 시각 |

### Filing

| 필드 | 타입 | Null | 설명 |
| --- | --- | --- | --- |
| `accessionNo` | string(32) | 아니요 | `cik`와 복합 PK |
| `cik` | string(10) | 아니요 | `accessionNo`와 복합 PK |
| `formType` | string(20) | 아니요 | SEC form type |
| `filingDate` | date | 예 | 제출일 |
| `reportDate` | date | 예 | 보고 기준일 |
| `primaryDoc` | text | 예 | 원본 문서명 |
| `filingUrl` | text | 아니요 | SEC 원문 URL |
| `status` | enum string | 아니요 | pending/downloaded/failed |
| `filePath` | text | 예 | 레거시 이관 출처, 신규 DB 저장 시 null (deprecated) |
| `checksum` | string(64) | 예 | DB 원문 UTF-8 bytes의 SHA-256 |
| `documentSizeBytes` | bigint/string | 예 | DB 원문 실제 byte 수; SEC 선언 fileSize와 별도 |
| `parserStatus` | string(255) | 아니요 | 후처리 상태 |
| `errorMessage` | text | 예 | 마지막 실패 원인 |
| `retryCount` | integer | 아니요 | 누적 재시도 횟수 |
| `updatedAt` | datetime | 아니요 | 갱신 시각 |

## 10. 실행 및 검증

### 서버 실행

```sh
cd 20-portfolio/1-reason-hwang/2-bff-apps
pnpm dev
```

### Swagger 확인

```text
http://localhost:2801/docs/sec
```

### 읽기 전용 smoke test

```sh
curl 'http://localhost:2801/api/sec/companies?limit=1'
curl 'http://localhost:2801/api/sec/filings/status-summary'
```

### Bruno 시나리오

실행 가능한 계약은 `bruno-api-tests`에 있다. POST 시나리오는 SEC 외부 통신, DB 변경 또는 파일 쓰기를 수행하므로 대상 환경을 확인한 후 실행해야 한다.

## 11. 현재 제약 및 개선 후보

1. 인증과 권한 검사가 없어 외부에 그대로 공개하면 수집·다운로드·상태 변경 API를 누구나 호출할 수 있다.
2. job API가 동기 실행이므로 SEC 응답과 다운로드 수에 따라 요청 시간이 길어질 수 있다.
3. 동일 job의 중복 실행을 막는 idempotency key 또는 분산 lock이 없다.
4. `downloaded-reports`는 보고서 전체 본문을 JSON에 포함하므로 응답 크기가 클 수 있다.
5. controller의 양의 정수 파싱은 현재 `Number.parseInt` 기반이라 엄격한 정수 문자열 검증으로 개선할 여지가 있다.
6. 날짜는 형식 검사 후 JavaScript `Date`로 확인하므로 달력 날짜의 엄격한 round-trip 검증을 추가할 수 있다.
7. Swagger DTO상 `parserStatus`는 필수지만 controller는 생략을 허용해 빈 문자열로 처리하므로 계약을 일치시켜야 한다.
8. controller가 반환하는 `filters.limit/pageSize`와 서비스가 내부에서 적용하는 최대 `500` 값이 다를 수 있으므로 응답에는 실제 적용값을 반환하는 편이 명확하다.

## 12. SEC 공식 근거

- [EDGAR Application Programming Interfaces](https://www.sec.gov/search-filings/edgar-application-programming-interfaces): submissions JSON의 recent/history 구조와 nightly `submissions.zip`
- [SEC Developer Resources](https://www.sec.gov/about/developer-resources): bulk 사용 권고, 식별 가능한 User-Agent, 초당 최대 10요청 fair-access 정책
- [Accessing EDGAR Data](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data): filing archive 경로, CIK 및 accession number 구조
