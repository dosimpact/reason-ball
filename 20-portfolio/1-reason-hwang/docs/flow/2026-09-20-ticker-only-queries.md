# SEC-QUERY-TICKER-001: 회사·공시 목록 기본 티커 필터

- 날짜: 2026-09-20. 범위: us-corporate-filings / 2-bff-apps.
- 요청: 회사 및 filings 조회도 티커가 있는 회사를 기본 전제로 필터.
- 구현: CompanyService.listCompanies와 FilingService.listFilings에 NULLIF(BTRIM(company.ticker), '') IS NOT NULL 적용. 추가 검색조건과 AND 결합. count와 페이지 행에 같은 조건. 데이터 삭제 없음. 식별자로 직접 여는 원문 API는 보존.
- stock: [도메인 설계](../stock/us-corporate-filings/system-design.md#sec-query-ticker-001-목록-조회의-기본-범위), BFF API 명세, Bruno README/공통 안내 갱신.
- VAL-API-001: NULL/빈 문자열/공백 ticker 회사 fixture 추가. 회사 CIK/이름 검색에서 제외 및 기존 페이지 count 검증. 공시가 존재하는 무티커 회사 CIK로 조회해도 items=[], totalItems=0 확인. ticker 및 CIK AND 검색 확인. 수정공시 fixture에 정상 ticker 지정해 연결 회귀 보존.
- Bruno 기존 스킬 워크플로 재사용: 격리 PostgreSQL+Nest 실제 HTTP, 외부 SEC만 fixture. test:filing-routes:e2e 52 requests/tests/assertions PASS; 빌드 후 node scripts/verify-company-pagination.cjs 회사 28 requests/tests/assertions PASS. 로그 bruno-api-tests/reports/{filing-routes,company-pagination}.log.
- lint PASS, Node 회귀 17 PASS.
- VAL-BROWSER-001: Playwright MCP 직접 URL 탐색: companies?limit=1&ticker=AAA에서 한 건/count1, filings?cik=11&includeContent=true에서 빈 목록/count0 확인. .playwright-mcp/ticker-company-query.yml 및 ticker-excluded-filings.yml. favicon 404 외 동작 오류 없음. 소유 서버/임시 DB 종료. 실제 수집 재시작 없음.
