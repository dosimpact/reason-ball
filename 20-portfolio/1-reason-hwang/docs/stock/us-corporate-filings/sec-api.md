# SEC Upstream API 사양 및 연동 가이드

본 문서는 `us-corporate-filings` 도메인에서 미국 증권거래위원회(SEC) EDGAR 시스템으로부터 기업 정보 및 공시 보고서(10-K, 10-Q 등)를 수집하기 위해 호출하는 **SEC Upstream 엔드포인트**, **데이터 사양**, **호출 정책**을 정리한 Stock 문서입니다.

---

## 1. SEC Upstream 엔드포인트 목록

| 구분 | 목적 | HTTP Method | Upstream URL | 호출 주체 |
|---|---|---|---|---|
| **회사 마스터 동기화** | 전체 상장사 CIK / Ticker / 사명 매핑 목록 수집 | `GET` | `https://www.sec.gov/files/company_tickers.json` | `2-bff-apps` (`CompanyService`), `3-langgraph-fast` (`tenk_fetch_report.py`) |
| **기업별 공시 메타데이터** | 특정 기업의 recent 및 filings.files로 연결된 과거 공시 목록 및 SIC 수집 | `GET` | `https://data.sec.gov/submissions/CIK{cik10}.json` | `2-bff-apps` (`FilingBackfillService`), `3-langgraph-fast` (`tenk_fetch_report.py`) |
| **대량 공시 백필 (Bulk)** | SEC bulk 기업 범위의 과거 공시 메타데이터 일괄 다운로드 | `GET` | `https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip` | `2-bff-apps` (`FilingBackfillService`) |
| **공시 원문 보고서 다운로드** | 10-K, 10-Q 등의 원문 문서(HTML/HTM/TXT) 수집 | `GET` | `https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no_no_dash}/{primary_doc}` | `2-bff-apps` (`FilingBackfillService`), `3-langgraph-fast` (`tenk_fetch_report.py`) |

---

## 2. 엔드포인트별 상세 사양

### 2.1. 회사 마스터 목록 (`company_tickers.json`)
- **URL**: `https://www.sec.gov/files/company_tickers.json`
- **응답 형식**: JSON (정수 인덱스 키의 객체)
```json
{
  "0": {
    "cik_str": 320193,
    "ticker": "AAPL",
    "title": "Apple Inc."
  },
  "1": {
    "cik_str": 789019,
    "ticker": "MSFT",
    "title": "MICROSOFT CORP"
  }
}
```
- **정규화 및 저장**:
  - `cik_str`을 10자리 문자열(`0000320193`)로 0-패딩 변환.
  - `ticker`를 대문자 및 trim 처리.
  - `companies` 테이블에 `cik`를 고유 키로 `upsert`.

---

### 2.2. 기업별 최근 공시 메타데이터 (`submissions/CIK{cik}.json`)
- **URL**: `https://data.sec.gov/submissions/CIK{cik10}.json` (예: `CIK0000320193.json`)
- **특징**: 열 지향(Columnar) 배열 구조
- **주요 필드**:
  - `sic`: 산업분류코드 (기업 테이블 업데이트에 반영)
  - `filings.recent`: 최근 공시 목록 객체
    - `accessionNumber`: `["0000320193-25-000079", ...]`
    - `filingDate`: `["2025-10-31", ...]`
    - `reportDate`: `["2025-09-27", ...]`
    - `acceptanceDateTime`: `["2025-10-31T18:01:14.000Z", ...]`
    - `form`: `["10-K", "10-Q", "8-K", ...]`
    - `primaryDocument`: `["aapl-20250927.htm", ...]`
    - `primaryDocDescription`: `["10-K", ...]`
- **정규화 및 저장**:
  - 대상 서식(`10-K`, `10-Q`) 및 수집 기준일(`sinceDate`) 필터링.
  - `filings` 테이블에 `accession_no`를 키로 `pending` 상태 저장.

---

### 2.3. 대량 공시 메타데이터 일괄 백필 (`submissions.zip`)
- **URL**: `https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip`
- **특징**: SEC EDGAR에서 매일 밤(nightly) 갱신하는 전체 기업의 submissions JSON을 담은 압축 파일(수백 MB ~ 수 GB 단위).
- **용도**: 과거 다년간(최대 20년)의 공시 데이터를 단일 파일 스트리밍/압축 해제를 통해 로컬 DB에 고속 동기화하여, 수만 번의 개별 API 호출을 방지.

---

### 2.4. 공시 원문 보고서 다운로드 (EDGAR Archives)
- **URL 규칙**:
  - 원문 HTML/HTM: `https://www.sec.gov/Archives/edgar/data/{cik_no_zero}/{accession_no_no_dash}/{primary_doc}`
  - 전체 원문 TXT: `https://www.sec.gov/Archives/edgar/data/{cik_no_zero}/{accession_no_no_dash}/{accession_no}.txt`
  - *예시*: `https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm`
- **저장 정책**:
  - 로컬 파일 시스템 의존성을 제거하고, PostgreSQL DB의 `filings.document_content` 컬럼(TEXT)에 직접 원문 본문 및 `content_type`을 영속화함.

---

## 3. SEC 연동 및 호출 필수 준수 정책 (Fair-Access)

1. **User-Agent 헤더 필수 지정**:
   - SEC EDGAR는 호출자 식별을 의무화하고 있습니다.
   - 형식: `User-Agent: {회사명/서비스명} {연락처이메일}` (예: `ReasonHwangPortfolio reason@example.com`)
   - 헤더가 누락되거나 표준 형식이 아니면 SEC에서 **403 Forbidden**을 반환합니다.
2. **요청 속도 제한 (Rate Limiting)**:
   - SEC 규정상 **초당 최대 10회(10 req/s)** 이하로 호출을 제한해야 합니다.
   - 본 시스템은 `SecClientService` 내부의 `throttleQueue` 및 타임스탬프 기반 대기를 통해 직렬화된 딜레이(최소 100ms 이상 간격)를 강제합니다.
   - 초과 시 **429 Too Many Requests**가 발생하며 일시적 IP 차단 위험이 있습니다.
3. **다운로드 크기 제한**:
   - 악의적이거나 비정상적인 대용량 파일 유입을 방지하기 위해 기본 최대 20MB(`secDocumentMaxBytes`) 크기 제한을 적용합니다.

현재 BFF 전송·타입 계약은 [lib SEC 명세](../../../2-bff-apps/src/lib/sec/.docs/api-spec.md)를 따른다. 원문은 ZIP과 별도 수집하며 백필은 SSE로 진행을 보고한다.
