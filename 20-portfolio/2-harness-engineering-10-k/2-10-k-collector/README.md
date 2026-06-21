# 2-10-k-collector

SEC EDGAR에서 기업/공시 메타데이터를 수집하고, 공시 원문 파일을 로컬에 저장하는 Nest.js 기반 수집기입니다.

## 1. 역할

- 기업 목록(`companies`) 동기화
- 10-K/10-Q/6-K/20-F(및 A 폼) 메타데이터 수집
- 원문 파일 다운로드 및 상태(`pending`, `downloaded`, `failed`) 관리
- REST API와 CLI를 모두 제공

## 2. 수집 흐름

1. `company-sync-jobs`로 SEC 회사 목록을 `companies` 테이블에 동기화합니다.
2. `filing-sync-jobs`로 공시 메타데이터를 `filings` 테이블에 적재합니다.
3. 이때 다운로드 전 대상은 `status = pending` 상태로 먼저 큐잉됩니다.
4. `filing-download-jobs`가 `pending` 항목을 실제 파일로 다운로드합니다.
5. 다운로드 성공 시 `downloaded`, 실패 시 `failed`로 상태가 변경됩니다.
6. `filings/status-summary`, `filings`로 현재 상태를 조회하고, `filing-retry-jobs`로 실패 건을 재시도 큐로 복귀시킬 수 있습니다.

## 3. SEC 원천 데이터 소스

이 프로젝트는 아래 SEC 공개 데이터/API를 원천으로 사용합니다.

1. 회사 목록 스냅샷
- `https://www.sec.gov/files/company_tickers.json`
- 사용 위치: `companies-sync`
- 용도: `cik`, `ticker`, `name` 초기 동기화

2. 회사별 제출 메타데이터
- `https://data.sec.gov/submissions/CIK{10자리 CIK}.json`
- 예: `https://data.sec.gov/submissions/CIK0000320193.json`
- 사용 위치: `filings-sync`
- 용도: `accession_no`, `form_type`, `filing_date`, `primary_doc` 등 수집

3. 공시 원문 파일(EDGAR Archive)
- `https://www.sec.gov/Archives/edgar/data/{정규화 CIK}/{accession_no_without_dash}/{primary_doc}`
- 사용 위치: `filing-download`
- 용도: 실제 문서 파일 다운로드 후 로컬 저장

참고:
- 모든 SEC 요청은 `SEC_USER_AGENT` 헤더를 사용합니다.
- 요청 속도/재시도는 `SEC_RATE_LIMIT_RPS`, `SEC_RETRY_COUNT`로 제어됩니다.

## 4. 빠른 실행

### 4.1 준비

```bash
cd 2-10-k-collector
cp .env.example .env
pnpm install
```

### 4.2 PostgreSQL 실행

```bash
cd ../1-infra-graph-rag
docker compose up -d postgres
```

기본 연결 대상은 `1-infra-graph-rag`의 PostgreSQL이며, 호스트 포트는 `.env` 기준 `55432`입니다.
패키지 실행 스크립트는 셸에서 `DATABASE_URL`을 직접 지정하지 않은 경우 이 로컬 기본값을 먼저 export하므로, 오래된 로컬 `.env`가 있더라도 루트 `infra:up` 데이터베이스에 연결됩니다.

### 4.3 API 서버 실행

```bash
pnpm run start:dev
# 또는
pnpm run start
```

기본 주소: `http://localhost:3305/api`
Swagger 문서: `http://localhost:3305/docs`

## 5. 환경변수

`.env.example` 기준:

- `DATABASE_URL` (권장) 또는 `POSTGRES_*` 조합
- `APP_HOST`, `APP_PORT` (기본 `0.0.0.0:3305`)
- `SEC_USER_AGENT` (SEC 호출 정책 준수용)
- `SEC_RATE_LIMIT_RPS`, `SEC_RETRY_COUNT`
- `DATA_DIR` (기본 `./data`, 원문 파일 저장 루트)

## 6. REST API 사용 예시

이 섹션에서 호출하는 API들의 원천 데이터는 SEC 공개 API/파일입니다.

- 회사 목록: `https://www.sec.gov/files/company_tickers.json`
- 회사별 공시 메타: `https://data.sec.gov/submissions/CIK{10자리 CIK}.json`
- 공시 원문: `https://www.sec.gov/Archives/edgar/data/{CIK}/{accessionNoNoDash}/{primaryDoc}`

간단 로직:
1. `company-sync-jobs`가 회사 마스터(`companies`)를 갱신
2. `filing-sync-jobs`가 공시 메타를 수집해 `filings(status=pending)`로 큐잉
3. `filing-download-jobs`가 `pending`을 실제 파일로 다운로드해 `downloaded/failed`로 상태 변경
4. `filings/status-summary`, `filings`, `filing-retry-jobs`로 상태 조회/운영

### 6.1 기업 목록 동기화

```bash
curl -s -X POST http://localhost:3305/api/company-sync-jobs
```

### 6.2 공시 메타데이터 동기화

```bash
curl -s -X POST http://localhost:3305/api/filing-sync-jobs \
  -H 'content-type: application/json' \
  -d '{"page": 1, "pageSize": 100, "since": "2025-01-01"}'
```

- `page`: 처리할 페이지 번호 (기본 1)
- `pageSize`: 한 번에 처리할 기업 수 (기본 100)
- `limitCompanies`: 구버전 호환용 별칭. 내부적으로 `pageSize`와 동일하게 처리
- `since`: `YYYY-MM-DD` 이후 공시만 동기화
- `tickers`: 특정 티커 목록만 동기화. 지정하면 `page/pageSize` 대신 대상 회사만 처리
- `ciks`: 특정 CIK 목록만 동기화. 1~10자리 숫자를 10자리로 패딩

예:
- 전체 10,000개 회사를 100개씩 처리하려면 `page=1..100`, `pageSize=100`으로 100번 호출
- 로컬 데모/검증에 필요한 핵심 티커만 빠르게 준비하려면 `{"tickers":["AAPL","MSFT"],"since":"2025-01-01"}`처럼 호출
- 각 호출은 해당 페이지 회사만 순차 처리하며, SEC 요청은 `SEC_RATE_LIMIT_RPS`, `SEC_RETRY_COUNT` 정책에 따라 쓰로틀링/재시도됩니다.

### 6.3 다운로드 실행

```bash
curl -s -X POST http://localhost:3305/api/filing-download-jobs \
  -H 'content-type: application/json' \
  -d '{"maxFiles": 200, "since": "2025-01-01", "ciks": ["0000320193"]}'
```

- `maxFiles`: 최대 다운로드 개수 (기본 500)
- `since`: `YYYY-MM-DD` 이후 filing만 다운로드
- `ciks`: 특정 CIK만 다운로드 (선택)
- `tickers`: 특정 티커만 다운로드 (선택). 내부에서 회사 CIK로 해석

### 6.4 상태 요약 조회

```bash
curl -s 'http://localhost:3305/api/filings/status-summary?since=2025-01-01'
```

### 6.5 다운로드 대상 상세 조회

```bash
curl -s 'http://localhost:3305/api/filings?status=pending&limit=20&cik=0000320193'
```

### 6.6 다운로드된 보고서 조회

```bash
curl -s 'http://localhost:3305/api/filings/downloaded-reports?page=1&pageSize=5&formType=10-K&ticker=AAPL&since=2025-01-01'
```

- `page`, `pageSize`: 페이지네이션
- `formType`: 예: `10-K`, `10-Q`
- `cik`: 특정 회사 CIK 필터
- `ticker`: 회사 ticker 필터
- `since`: `YYYY-MM-DD` 이후 filing만 조회
- `parserStatus`: parser 후처리 상태 정확 일치 필터. 빈 문자열은 아직 파싱되지 않은 downloaded filing을 의미
- 응답 `items[].content`: 로컬 static 파일에서 읽은 보고서 원문

### 6.7 실패 건 재시도 큐 복귀

```bash
curl -s -X POST http://localhost:3305/api/filing-retry-jobs \
  -H 'content-type: application/json' \
  -d '{"limit": 100, "since": "2025-01-01"}'
```

## 7. CLI 모드

API 대신 일회성 CLI 실행도 가능합니다.

```bash
pnpm run companies:sync
pnpm run filings:collect -- --limit-companies 100 --since 2025-01-01 --max-files 200
pnpm run filings:collect -- --tickers AAPL,MSFT --since 2025-01-01 --max-files 20
```

위 CLI 스크립트도 기본적으로 `postgresql://postgres:postgres@127.0.0.1:55432/sec_collector`를 사용합니다.
다른 데이터베이스를 쓰려면 실행 전에 `DATABASE_URL=...`을 명시하세요.

## 8. 출력 데이터

- DB 테이블: `companies`, `filings`
- schema 관리: TypeORM migration이 앱 시작 시 실행됩니다. 런타임 `synchronize`는 비활성화되어 있으므로 운영 DB schema 변경은 migration으로 추가하세요.
- 원문 파일: `${DATA_DIR}/filings/...`
