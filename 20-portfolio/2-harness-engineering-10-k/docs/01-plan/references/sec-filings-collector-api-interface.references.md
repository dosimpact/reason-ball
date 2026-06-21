# SEC Filings Collector API Interface (POC)

## 목적
- `5.10-k-collector`의 실제 구현 기준 인터페이스를 정리한다.
- 현재는 HTTP API가 아니라 배치 실행용 CLI API + 내부 서비스 API가 기준이다.

## 구현 위치
- 프로젝트 루트: `5.10-k-collector`
- 엔트리 포인트: `5.10-k-collector/src/main.ts`

## 1) 실행 API (CLI)

### 1. `companies:sync`
- 명령: `pnpm run companies:sync`
- 설명: SEC 기업 목록(`company_tickers.json`)을 `companies` 테이블에 upsert
- 출력 포맷:
```text
[companies:sync] synced=<number>
```

### 2. `filings:collect`
- 명령:
```bash
pnpm run filings:collect -- --limit-companies <N> --since <YYYY-MM-DD> --max-files <M>
```
- 옵션
  - `--limit-companies`: 수집 대상 기업 수 (양의 정수, 기본값 `100`)
  - `--since`: 해당 날짜 이상 공시만 수집 (선택)
  - `--max-files`: 이번 실행에서 다운로드할 최대 파일 수 (양의 정수, 기본값 `500`)
- 설명: 대상 기업의 공시 메타 수집(upsert) + pending 파일 다운로드 + 상태 갱신
- 출력 포맷:
```text
[filings:collect] companies=<number> synced=<number> downloaded=<number> failed=<number>
```

### CLI 에러 규칙
- 알 수 없는 옵션 전달 시: `Unknown option: ...`
- `--limit-companies`, `--max-files`가 숫자 아님/0 이하: 에러
- `--since` 포맷 불가: `Invalid --since date: ...`
- `companies` 데이터가 없으면: `No companies in DB. Run companies:sync first.`

## 2) 내부 서비스 API (Nest)

### 1. Companies Sync Module
- 모듈: `src/companies-sync/companies-sync.module.ts`
- 서비스: `src/companies-sync/companies-sync.service.ts`
- public method:
```ts
syncCompanies(): Promise<{ syncedCount: number }>
```
- 동작
  - `https://www.sec.gov/files/company_tickers.json` 조회
  - CIK 10자리 정규화, ticker 대문자화
  - CIK 기준 dedupe 후 upsert

### 2. Filings Collector Module
- 모듈: `src/filings-collector/filings-collector.module.ts`
- 서비스: `src/filings-collector/filings-collector.service.ts`
- public method:
```ts
collectAndDownload(options: {
  limitCompanies: number;
  since?: string;
  maxFiles: number;
}): Promise<{
  companiesProcessed: number;
  filingsSynced: number;
  downloaded: number;
  failed: number;
}>
```
- 대상 폼
  - `10-K`, `10-K/A`, `10-Q`, `10-Q/A`, `6-K`, `6-K/A`, `20-F`, `20-F/A`
- 핵심 처리
  - `submissions/CIK##########.json` 조회
  - 대상 폼 필터링 + date 필터
  - `filings` upsert (`accession_no + cik`)
  - `pending` 상태 파일 다운로드
  - 성공 `downloaded`, 실패 `failed`, `retry_count` 증가

## 3) 외부 API 인터페이스 (SEC)
- 기업 목록
  - `GET https://www.sec.gov/files/company_tickers.json`
- 기업 제출 내역
  - `GET https://data.sec.gov/submissions/CIK##########.json`
- 원문 다운로드 URL 패턴
  - `https://www.sec.gov/Archives/edgar/data/{cikNoLeadingZero}/{accessionNoWithoutDash}/{primaryDoc}`
- 요청 헤더
  - `User-Agent: <SEC_USER_AGENT>`
  - `Accept: application/json, text/plain, */*`
- 요청 제어
  - rate limit: `SEC_RATE_LIMIT_RPS` (기본 4 rps)
  - retry: 429/5xx 대상 exponential backoff (`SEC_RETRY_COUNT`, 기본 3)

## 4) 데이터베이스 인터페이스 (PostgreSQL)

### `companies`
- PK: `cik` (varchar(10))
- 컬럼: `ticker`, `name`, `sic`, `updated_at`

### `filings`
- 복합 PK: `accession_no`, `cik`
- 컬럼
  - 메타: `form_type`, `filing_date`, `report_date`, `primary_doc`, `filing_url`
  - 상태: `status` (`pending` | `downloaded` | `failed`)
  - 파일: `file_path`, `checksum`
  - 운영: `error_message`, `retry_count`, `updated_at`

## 5) 파일 저장 인터페이스
- 루트: `${DATA_DIR}/filings` (`DATA_DIR` 기본 `./data`)
- 경로 규칙:
```text
data/filings/{cik}/{form_type}/{accession_no}/{primary_doc}
```
- 경로 segment는 영문/숫자/`._-` 외 문자를 `-`로 sanitize
- 다운로드 후 SHA-256 checksum 저장

## 6) 환경변수 인터페이스
- DB
  - `DATABASE_URL` (우선)
  - 또는 `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- SEC
  - `SEC_USER_AGENT`
  - `SEC_RATE_LIMIT_RPS`
  - `SEC_RETRY_COUNT`
- Path
  - `DATA_DIR`

## 7) 표준 실행 시퀀스
1. `pnpm install`
2. `docker-compose up -d`
3. `pnpm run companies:sync`
4. `pnpm run filings:collect -- --limit-companies 100 --since 2023-01-01 --max-files 500`

## 8) 현재 범위와 확장 포인트
- 현재 인터페이스는 배치 CLI 중심이며 HTTP REST API는 아직 없다.
- 추후 API 서버가 필요하면 `main.ts` CLI 파서 대신/추가로 Controller 레이어를 붙여 동일 서비스(`CompaniesSyncService`, `FilingsCollectorService`)를 재사용하는 구조가 적합하다.
