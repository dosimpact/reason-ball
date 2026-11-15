# SEC-COMPANY-COUNTS-001: 기업 및 공시 테이블의 공시 건수

- 날짜: 2026-11-16
- 요청: SEC 수집 관리의 기업 및 공시 테이블에 ticker별 전체·formType별 수집 공시 count 표시.
- 집계 기준: CIK별 현재 로컬 DB의 모든 공시 메타데이터. 기간 필터 없음, /A는 별도 양식, document_content 보유 여부와 독립.
- 계약: GET /api/sec/companies 각 item에 filingCounts={total:number,byFormType:[{formType,count}]} 추가. 0건은 total=0/빈 배열.
- 설계: 기업 목록의 현재 page CIK들을 한 번의 그룹 집계로 조회. 원문 미조회·기업당 추가 요청 없음. DB schema 변경 없음.
- 검증 계획: 기업/공시 없는 기업/양식별 합계/페이지·검색/CIK 격리의 회귀 및 Bruno 실제 HTTP 검증, Storybook 표·확장 행, Playwright MCP 사용자 화면 확인. 결과와 자원 정리는 아래 추가.
- 기존 사용자 변경·staged 변경·human-docs·기존 flow 보존.

## 검증 결과

- BFF build/lint PASS. 신규 company-filing-counts 단위 3/3 PASS(페이지 CIK 일괄 집계·빈 페이지·집계 오류 전파).
- 실제 BFF 2980에서 Bruno `01-companies/03-filing-counts.bru`, `04-company-count-sample.bru`, `05-count-matches-filings.bru`: 3 requests/3 tests/5 assertions PASS. AAPL 총275와 GET filings pagination.totalItems 일치.
- READ ONLY EXPLAIN ANALYZE: AAPL+CPNG 표본의 idx_filings_cik_filing_date Index Scan, 352행/10그룹, 실행1.788ms. 원문 컬럼 미조회. DB 연결 rollback/close.
- FE typecheck/수정 파일 ESLint PASS. Storybook CompanyFilingCounts 1/1 PASS(전체275·수정본 별도·0건·확장 후 원문 링크 보존). 다른 legacy story12개는 이 대상 실행에서 제외. 동시 접근성 label 변경에 맞춰 selector를 정규식으로 수정 후 재실행 PASS.
- Playwright MCP 사용자 검증 PASS: 소유 Host2993 → 실제 BFF2980. 기업 검색 AAPL → 전체275 및10-K/A·8-K/A 별도 표시 → 기업 행 확장 → 공시 목록·페이지·원문/XBRL 링크 확인. 수집/DB 변경 요청 없음.
- 증거: `.playwright-mcp/page-2026-11-15T15-33-44-017Z.yml` 및 같은 MCP 실행 후 snapshot. 콘솔은 favicon404 외 오류 없음.
- 적용 스킬: apb-bruno-api-tests, apb-playwright-e2e, supabase-postgres-best-practices.

## 문서·자원 정리

- [화면 stock](../stock/us-corporate-filings/collector-dashboard.md#sec-company-counts-001-기업별-공시-메타데이터-집계), [시스템 stock](../stock/us-corporate-filings/system-design.md#sec-company-counts-001-기업-목록-공시-집계) 동기화. 코드/문서 scoped 공백 검사 PASS.
- 별도 MCP PID89124는 browser_close 후 프로세스 종료 확인. 소유 Host2993은 Ctrl+C 정상 종료, `.next-company-counts`와 해당 tsconfig include만 정리. 기존 BFF2980·사용자브라우저·공유MCP 유지.
- 다른 작업과 파일/기존 index가 겹치므로 기존 staged 변경을 포함하는 코드 커밋은 만들지 않음. 기능 코드는 검증된 작업 트리에 보존. 이번 실행 기록만 별도 커밋.
