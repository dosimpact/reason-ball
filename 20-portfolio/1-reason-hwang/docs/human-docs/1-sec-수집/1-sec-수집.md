

# SEC 수집

sec api edgar에서 데이터를 수집 및 동기화 하는 작업을 진행한다.  

## API Listing

- 공통 경로: `http://127.0.0.1:2980/api/sec` (아래 경로 앞에 `/api/sec`를 붙인다).
- GET은 로컬 PostgreSQL 조회이며 SEC에 실시간 요청하지 않는다. POST는 SEC 수집·DB 갱신 작업.
- 테이블 : 기업 정보는 `companies`, 공시 메타데이터·원문은 `filings`에 저장한다.

### 1. POST /api/sec/company-sync-jobs — 기업 주소록 동기화

설명: SEC `company_tickers.json`의 CIK·티커·회사명을 받아 `companies`에 CIK 기준으로 추가·갱신한다.
- 공시 목록이나 원문은 수집하지 않는다. 이름은 jobs지만 별도 작업 ID만 즉시 반환하지 않고 동기화 완료를 기다린다.
- POST /api/sec/company-sync-jobs

#### Upstream — SEC 기업 티커 목록

BFF가 외부 SEC에 보내는 요청은 아래 **GET 1회로 JSON 목록 전체를 받는 방식**이다. BFF의 동기화 POST와 upstream의 HTTP 메서드는 다르다.

```http
GET https://www.sec.gov/files/company_tickers.json
User-Agent: your-app contact@example.com
Accept: application/json, text/plain, */*
```

- query·body·페이지네이션 없음. 이 공개 JSON 조회에는 API key를 사용하지 않는다.
- 실제 User-Agent는 BFF의 `SEC_USER_AGENT` 환경변수를 사용한다. 위 연락처는 예시다.

**Upstream 응답 형태**: 배열이 아니라 숫자 모양의 문자열 키를 가진 객체다. 각 키는 항목 순번이며 CIK나 티커가 아니다. 아래 항목과 순서는 형태 설명용 예시다.

```json
{
  "0": { "cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc." },
  "1": { "cik_str": 789019, "ticker": "MSFT", "title": "MICROSOFT CORP" }
}
```

```ts
type UpstreamCompanyTickers = Record<string, {
  cik_str: number;
  ticker: string;
  title: string;
}>;
```

| Upstream 필드 | 의미 | 로컬 `companies` 매핑 |
| --- | --- | --- |
| `cik_str` | SEC 기업 식별자. 필드 이름과 달리 JSON 값은 숫자 | `cik`: 10자리 문자열로 보정. `320193` → `0000320193` |
| `ticker` | 종목 기호 | `ticker`: 공백 제거·대문자 변환. 값이 없으면 `null` |
| `title` | SEC 기준 회사명 | `name`: 앞뒤 공백 제거 |
| 없음 | 이 파일에는 SIC가 없음 | 현재 동기화 코드는 `sic: null`로 저장 |

BFF는 CIK가 유효한 숫자이고 회사명이 있는 항목을 골라 **CIK 단위로 중복 제거 후 upsert**한다. 한 CIK에 여러 티커가 있으면 현재 구조상 마지막 항목 하나가 남는다. `syncedCount`는 이 처리 후 기업 수이며 upstream 항목 수·신규 삽입 수와 다를 수 있다.

이 파일은 기업 주소록 매핑만 제공한다. 공시 목록·원문·거래소·현재 상장 여부는 포함하지 않는다. SEC는 목록의 정확성·전체 범위를 보장하지 않으며 한 번 받았다고 영구적으로 최신인 것은 아니다.

출처: [SEC EDGAR 데이터 안내](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data), [원본 JSON](https://www.sec.gov/files/company_tickers.json).

### 2. GET /companies — 저장된 기업 조회

설명: `companies`에서 티커가 비어 있지 않은 기업만 조회한다. 기업명/티커 검색과 페이지 조회를 지원한다.

| Query | 기본값 / 허용값 | 설명 |
| --- | --- | --- |
| `page` | `1`, 양의 정수 | 페이지 번호 |
| `pageSize` | `50`, 최대 `100000` | 페이지당 건수. 최댓값 초과는 상한으로 제한 |
| `limit` | 생략 | `pageSize`의 호환 별칭. 둘 다 있으면 `pageSize` 우선 |
| `cik` | 생략, 숫자 1~10자리 | 기업 식별자. 10자리로 보정 후 정확히 일치 |
| `ticker` | 생략 | 티커 정확히 일치. 공백 제거·대문자 변환 |
| `q` | 생략 | 회사명 또는 티커 부분 검색. 대소문자 구분 없음 |

```http
GET /api/sec/companies?q=apple&page=1&pageSize=10
```
응답: 
```json
{
  "filters": { "page": 1, "pageSize": 10, "limit": 10, "q": "apple" },
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 1, "totalPages": 1, "hasNextPage": false },
  "items": [
    { "cik": "0000320193", "ticker": "AAPL", "name": "Apple Inc.", "sic": 3571, "updatedAt": "2026-11-15T00:00:00.000Z" }
  ]
}
```

### 3. POST /company-filing-sync-jobs — 선택 기업 공시 수집

설명: 로컬 DB에서 대상 기업을 찾고 SEC 기업별 submissions 및 과거 이력 JSON을 읽어 `filings`에 저장한다. 그 뒤 옵션에 따라 원문을 다운로드한다. 먼저 기업 동기화가 필요하며 요청한 기업 중 하나라도 DB에 없으면 오류가 발생한다.

요청: `Content-Type: application/json`. `ciks` 또는 `tickers` 중 하나 이상 필수.

| Body | 기본값 / 허용값 | 설명 |
| --- | --- | --- |
| `ciks` | 문자열 배열, 선택 | 대상 CIK 목록. 숫자 1~10자리 → 10자리 보정·중복 제거 |
| `tickers` | 문자열 배열, 선택 | 대상 티커 목록. 대문자 변환·중복 제거 |
| `years` | 숫자 `20`, 정수 `1~30` | 오늘(UTC) 기준 최근 N년. 문자열 `"5"`는 불가 |
| `since` | 생략, `YYYY-MM-DD` | 이 날짜 이상에 제출된 공시. 있으면 `years`보다 우선 |
| `downloadDocuments` | boolean `true` | `false`이면 메타데이터만, `true`이면 원문까지 수집 |
| `refreshArchive` | boolean `false` | 공통 DTO에는 있지만 이 API에서는 사용하지 않음. 전체 기업 ZIP 수집용 옵션 |

```json
{
  "tickers": ["AAPL", "MSFT"],
  "since": "2025-01-01",
  "downloadDocuments": false
}
```

- CIK와 티커를 둘 다 넣으면 합집합(OR)으로 기업을 선택한다.
- 호환 입력 `cik`, `ticker`도 지원한다. 예: `{"ticker":"AAPL"}`. 복수 필드가 단수 별칭보다 우선한다.
- 목록에는 `"AAPL,MSFT"` 같은 쉼표 구분 문자열도 허용하지만 JSON 배열을 권장한다.
- `since`가 있어도 잘못된 `years`는 거절된다. `formType`, `until`, `limit`는 이 body의 지원 필드가 아니며 현재 알 수 없는 필드는 무시한다.  
- 수집 폼은 현재 `10-K`, `10-K/A`, `10-Q`, `10-Q/A`, `8-K`, `8-K/A`로 고정된다. (하드코딩)  
- /A가 붙은건  Amendment, 즉 기존 보고서의 수정·보완본  

응답: `200 OK`, `text/event-stream`. 일반 JSON 한 건이 아니라 아래 공통 SSE 이벤트를 받는다. `completed`의 data 구조:

```json
{
  "companiesProcessed": 2,
  "filingsSynced": 20,
  "downloaded": 0,
  "failed": 0
}
```

`companiesProcessed`는 처리한 기업 수, `filingsSynced`는 이번 저장 처리한 공시 메타데이터 수(순수 신규 건수와 다를 수 있음), `downloaded`/`failed`는 원문 다운로드 성공·실패 수다.

upstream api 
- ① 기업별 최근 공시 메타데이터 조회
- GET https://data.sec.gov/submissions/CIK{10자리-CIK}.json  
- GET https://data.sec.gov/submissions/CIK0000320193.json  
- ② 필요한 과거 공시 이력 추가 조회 ( 
- {
name: "CIK0000320193-submissions-001.json",
filingCount: 1278,
filingFrom: "1994-01-26",
filingTo: "2015-10-05"
})
- 메타데이터 양이 너무 많으면 next pagination을 준다.  
-  GET https://data.sec.gov/submissions/{응답에 포함된 file.name}



### 4. POST /all-company-filing-sync-jobs — 전체 대상 기업 공시 수집

설명: 실행 시작 시 로컬 `companies`에 티커가 있는 기업들을 대상으로 SEC bulk submissions ZIP에서 메타데이터를 수집한다. 
- SEC 전체 제출 주체를 무조건 수집하는 의미가 아니다. ZIP 캐시가 있으면 재사용하며 옵션에 따라 원문도 다운로드한다.

요청: body 생략 또는 `{}` 가능. 생략 시 최근 20년·원문 포함이므로 첫 확인에는 아래처럼 범위를 줄인다.

| Body | 기본값 / 허용값 | 설명 |
| --- | --- | --- |
| `years` | 숫자 `20`, 정수 `1~30` | 최근 N년 공시 |
| `downloadDocuments` | boolean `true` | 원문 수집 여부 |
| `refreshArchive` | boolean `false` | `true`면 bulk ZIP을 다시 다운로드. `false`면 기존 캐시 재사용, 캐시 없으면 다운로드 |

```json
{
  "years": 1,
  "downloadDocuments": false,
  "refreshArchive": false
}
```

이 API에는 `ciks`, `tickers`, `since` 필터가 없다. 선택 기업 수집은 3번 API를 사용한다.

응답: `200 OK`, `text/event-stream`. `completed`의 data 구조:

```json
{
  "tickerOnly": true,
  "totalCompanies": 10000,
  "processedEntries": 10000,
  "companiesUpserted": 10000,
  "filingsSeen": 50000,
  "filingsUpserted": 50000,
  "lastEntry": "CIK0000320193.json",
  "downloaded": 0,
  "failed": 0
}
```

`totalCompanies`: 대상 기업 수, `processedEntries`: ZIP 처리 항목 수, `companiesUpserted`: 기업 저장 처리 수, `filingsSeen`/`filingsUpserted`: 수집 후보·저장 처리 공시 수, `lastEntry`: 마지막 ZIP 항목명 또는 `null`. 저장 처리 수는 신규 삽입 건수와 같다고 보장하지 않는다.

### 5. GET /filings — 저장된 공시 목록·메타데이터 조회

설명: `filings`를 기업과 연결해 조회한다. 기본적으로 티커가 있는 기업만 포함한다. 원본·수정본 관계를 연결해서 보여주지만 문서를 자동 병합하지 않는다.

요청: body 없음. 아래 query는 모두 선택이다.

| Query | 기본값 / 허용값 | 설명 |
| --- | --- | --- |
| `page` | `1`, 양의 정수 | 페이지 번호 |
| `pageSize` | `50`, 최대 `500` | 페이지당 건수. 초과는 상한 제한 |
| `limit` | 생략 | `pageSize` 호환 별칭 |
| `cik` / `ticker` | 생략 | 기업 식별자 / 티커 정확히 일치 |
| `since` | 생략, `YYYY-MM-DD` | 제출일 하한(포함) |
| `formType` | 생략 | `10-K`, `10-Q` 등 폼 정확히 일치. 대문자 변환 |
| `status` | 생략 | `pending`, `downloaded`, `failed` 중 하나 |
| `parserStatus` | 생략 | 파싱/후처리 상태 문자열 정확히 일치. 빈 문자열도 필터 가능 |
| `includeContent` | `false` | `true`이면 항목에 `content` 원문 추가 |
| `includeAmendments` | `true` | `original`, `amendments`, 연결 상태 포함 여부 |
| `includeFormerRegistrants` | `false` | `true`이면 티커 없는 이전 법인도 포함. 명시적인 `cik` 필수 |

```http
GET /api/sec/filings?ticker=AAPL&formType=10-K&since=2025-01-01&status=downloaded&pageSize=10
```

응답: `200 OK`, JSON. 최상위는 기업 목록과 같은 `{filters, pagination, items}`이며, 각 item은 공시 메타데이터다.

| Item 필드 | 간단한 타입·의미 |
| --- | --- |
| `cik`, `accessionNo`, `formType` | string — 회사·공시 식별자·폼 유형 |
| `filingDate`, `reportDate` | 날짜 문자열 또는 null — 제출일·보고 대상일 |
| `status`, `parserStatus` | string — 원문 수집 상태·후처리 상태 |
| `filingUrl`, `primaryDoc` | 원문 URL(string), 원문 파일명(string 또는 null) |
| `documentContentType`, `documentDownloadedAt`, `documentSizeBytes` | MIME·수집 시각·원문 byte 수. nullable, bigint byte 수는 문자열 |
| `errorMessage`, `retryCount`, `updatedAt` | 오류(string 또는 null), 재시도 수(number), 갱신 시각 |
| `original`, `amendments` | 연결된 원본 객체 또는 null / 수정본 배열. `includeAmendments=true`일 때 |
| `amendmentLinkStatus`, `amendmentLinkBasis` | 연결 상태 / 연결 기준. 수정본 연결 활성화 시 |
| `content` | 원문 string 또는 null. `includeContent=true`일 때만 |

이외에도 `primaryDocDescription`, `fullSubmissionUrl`, `acceptedAt`, `items`, `fileNumber`, `filmNumber`, `fileSize`, `isXbrl`, `isInlineXbrl`, `filePath`, `checksum`, `sourceKind` 메타데이터가 포함된다. 원본·수정본 객체도 같은 공시 메타데이터 형식이다. 연결 상태는 `linked`, `missing-report-date`, `missing-original`, `ambiguous-original` 등이 있다.

`includeContent=true`의 원문 합계는 중첩 원본·수정본을 포함해 최대 64 MiB이며 초과 시 `413`이다. 저장되지 않은 원문은 `content: null`이고 자동 다운로드하지 않는다.

### 6. GET /filings/{cik}/{accessionNo}/content — 공시 원문 조회

설명: DB에 저장된 단일 공시 원문을 반환한다. SEC 실시간 조회·다운로드·수정본 병합은 하지 않는다.

요청: body와 query 없음.
- `cik` | 숫자 1~10자리, 서버에서 10자리로 보정 |
- `accessionNo` | `##########-##-######` 형식의 공시 접수번호 |

```http
GET /api/sec/filings/0000320193/0000320193-25-000079/content
```

응답: `200 OK`, JSON 포장 없는 HTML/XML/text 원문 문자열. 저장 MIME에 따라 `Content-Type`을 설정한다. 잘못된 식별자는 `400`, 공시 메타데이터가 없으면 `404`, 아직 원문이 저장되지 않았으면 `409`다.


## 데이터 통계

> 2026-11-16 조회 기록 기준. 현재 로컬 DB의 저장 건수이며 추가 수집에 따라 달라진다.

### 1. 전체 기업 수와 티커 보유 기업 수

- 전체 `companies`: **982,260개**
- 티커가 있는 기업: **8,557개**
- 티커가 없는 기업: **973,703개**
- 조회 API: `GET /api/sec/overview`. `GET /companies`는 티커가 있는 기업만 조회한다.
- 티커가 없다는 것만으로 비상장 기업이라고 판정하지 않는다.

### 2. Apple(AAPL)의 저장 공시 수

`GET /api/sec/filings?ticker=AAPL` 기준 **총 275건**이다.

| 공시 유형 | 건수 |
| --- | ---: |
| 10-K | 21 |
| 10-K/A | 1 |
| 10-Q | 61 |
| 10-Q/A | 1 |
| 8-K | 189 |
| 8-K/A | 2 |
| **합계** | **275** |

- 수정본(`/A`)도 별도 건수다. SEC 전체 이력이 아니라 현재 DB에 저장된 공시다.
- 275건 모두 원문 수집이 완료됐다는 뜻은 아니다.
- 메타데이터 전체 조회: `GET /api/sec/filings?ticker=AAPL&pageSize=500&includeAmendments=false&includeContent=false`.


## BFF에서는 SEC수집하는 API들이 있다. 

해결해야 할 문제 : SEC수집 API들을 호출하고 테스트 해볼 수 있는 front side admin이 필요하다. 
- 어떤 회사들이 있고, 어떤 공시가 모였는지 한눈에 볼 수 있는 대시보드가 필요하다.  
- › 'SEC 수집 관리'에 API testing(postman api, bruno api 처럼) 탭도 추가해서 api 수준으로 테스트 해볼
  수 있게도 추가해줘



SEC API 상장회사 목록.  